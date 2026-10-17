from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated
import secrets
import jwt
from fastapi import FastAPI, Depends, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pwdlib import PasswordHash
from sqlalchemy import select, func, or_, delete, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .schemas import (
    Register,
    Login,
    ProjectInput,
    Status,
    Priority,
    IssueInput,
    IssuePatch,
    CommentInput,
    MemberInput,
)
from .database import (
    Base,
    engine,
    settings,
    get_db,
    User,
    Project,
    Membership,
    Issue,
    Comment,
    LoginSession,
)


@asynccontextmanager
async def lifespan(app):
    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            # Serialize first-start schema creation across serverless instances.
            connection.execute(text("SELECT pg_advisory_xact_lock(457382019)"))
        Base.metadata.create_all(connection)
    yield


app = FastAPI(title="IssueFlow API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)
DB = Annotated[Session, Depends(get_db)]
passwords = PasswordHash.recommended()
dummy_hash = passwords.hash("timing-safe-dummy-password")
COOKIE = "issueflow_session"


def public_user(user):
    return {"id": user.id, "name": user.name, "email": user.email}


def current_user(request: Request, db: DB):
    token = request.cookies.get(COOKIE)
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    try:
        payload = jwt.decode(
            token or "",
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub", "jti"]},
        )
        session = db.get(LoginSession, payload["jti"])
        user = db.get(User, int(payload["sub"]))
        if not session or not user or session.user_id != user.id:
            raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(401, "Please sign in to continue")


CurrentUser = Annotated[User, Depends(current_user)]


@app.middleware("http")
async def protect_cookie_requests(request, call_next):
    # Cookie-authenticated writes must originate from an explicitly trusted UI.
    if (
        request.method in {"POST", "PATCH", "DELETE"}
        and request.cookies.get(COOKIE)
        and not request.headers.get("authorization")
    ):
        if request.headers.get("origin") not in settings.cors_origins.split(","):
            from fastapi.responses import JSONResponse

            return JSONResponse({"detail": "Untrusted request origin"}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


def sign_in(user, db, response):
    expiry = datetime.now(timezone.utc) + timedelta(hours=12)
    sid = secrets.token_hex(24)
    db.add(LoginSession(id=sid, user_id=user.id, expires_at=expiry))
    db.commit()
    token = jwt.encode(
        {"sub": str(user.id), "jti": sid, "exp": expiry}, settings.jwt_secret, algorithm="HS256"
    )
    response.set_cookie(
        COOKIE, token, httponly=True, secure=settings.cookie_secure, samesite="lax", max_age=43200
    )
    return {"user": public_user(user)}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/register", status_code=201)
def register(data: Register, response: Response, db: DB):
    user = User(
        name=data.name, email=str(data.email).lower(), password_hash=passwords.hash(data.password)
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists")
    return sign_in(user, db, response)


@app.post("/auth/login")
def login(data: Login, response: Response, db: DB):
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    valid = passwords.verify(data.password, user.password_hash if user else dummy_hash)
    if not user or not valid:
        raise HTTPException(401, "Email or password is incorrect")
    return sign_in(user, db, response)


@app.get("/auth/me")
def me(user: CurrentUser):
    return public_user(user)


@app.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response, db: DB, user: CurrentUser):
    token = request.headers.get("authorization", "").removeprefix("Bearer ") or request.cookies.get(
        COOKIE
    )
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    db.execute(delete(LoginSession).where(LoginSession.id == payload["jti"]))
    db.commit()
    response.delete_cookie(COOKIE, secure=settings.cookie_secure, httponly=True, samesite="lax")


def project_access(pid, user, db, owner=False):
    project = db.get(Project, pid)
    if not project or not db.scalar(
        select(Membership.id).where(Membership.project_id == pid, Membership.user_id == user.id)
    ):
        raise HTTPException(404, "Project not found")
    if owner and project.owner_id != user.id:
        raise HTTPException(403, "Only the project owner can do this")
    return project


def project_json(project, db):
    counts = dict(
        db.execute(
            select(Issue.status, func.count(Issue.id))
            .where(Issue.project_id == project.id)
            .group_by(Issue.status)
        ).all()
    )
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "owner_id": project.owner_id,
        "created_at": project.created_at,
        "total_issues": sum(counts.values()),
        "completed_issues": counts.get("Done", 0),
        "member_count": db.scalar(
            select(func.count()).select_from(Membership).where(Membership.project_id == project.id)
        ),
    }


@app.get("/projects")
def projects(db: DB, user: CurrentUser):
    rows = db.scalars(
        select(Project)
        .join(Membership)
        .where(Membership.user_id == user.id)
        .order_by(Project.created_at.desc())
    ).all()
    return [project_json(p, db) for p in rows]


@app.post("/projects", status_code=201)
def create_project(data: ProjectInput, db: DB, user: CurrentUser):
    project = Project(**data.model_dump(), owner_id=user.id)
    db.add(project)
    db.flush()
    db.add(Membership(project_id=project.id, user_id=user.id))
    db.commit()
    return project_json(project, db)


@app.get("/projects/{pid}")
def get_project(pid: int, db: DB, user: CurrentUser):
    return project_json(project_access(pid, user, db), db)


@app.patch("/projects/{pid}")
def edit_project(pid: int, data: ProjectInput, db: DB, user: CurrentUser):
    project = project_access(pid, user, db, owner=True)
    project.name, project.description = data.name, data.description
    db.commit()
    return project_json(project, db)


@app.delete("/projects/{pid}", status_code=204)
def delete_project(pid: int, db: DB, user: CurrentUser):
    db.delete(project_access(pid, user, db, owner=True))
    db.commit()


@app.get("/projects/{pid}/members")
def members(pid: int, db: DB, user: CurrentUser):
    project_access(pid, user, db)
    return [
        public_user(u)
        for u in db.scalars(
            select(User).join(Membership).where(Membership.project_id == pid).order_by(User.name)
        )
    ]


@app.post("/projects/{pid}/members", status_code=201)
def add_member(pid: int, data: MemberInput, db: DB, user: CurrentUser):
    project_access(pid, user, db, owner=True)
    member = db.scalar(select(User).where(User.email == str(data.email).lower()))
    if not member:
        raise HTTPException(404, "This person needs to register an IssueFlow account first")
    db.add(Membership(project_id=pid, user_id=member.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This person is already a project member")
    return public_user(member)


def validate_assignee(pid, assignee, db):
    if assignee is not None and not db.scalar(
        select(Membership.id).where(Membership.project_id == pid, Membership.user_id == assignee)
    ):
        raise HTTPException(422, "Assignee must be a member of this project")


def issue_json(issue, db, *, assignees=None, projects=None, comment_counts=None):
    assignee = (
        (
            assignees.get(issue.assigned_to)
            if assignees is not None
            else db.get(User, issue.assigned_to)
        )
        if issue.assigned_to
        else None
    )
    project = (
        projects[issue.project_id] if projects is not None else db.get(Project, issue.project_id)
    )
    comment_count = (
        comment_counts.get(issue.id, 0)
        if comment_counts is not None
        else db.scalar(
            select(func.count()).select_from(Comment).where(Comment.issue_id == issue.id)
        )
    )
    return {
        "id": issue.id,
        "key": f"ISS-{issue.id:03d}",
        "title": issue.title,
        "description": issue.description,
        "status": issue.status,
        "priority": issue.priority,
        "project_id": issue.project_id,
        "project_name": project.name,
        "created_by": issue.created_by,
        "assigned_to": issue.assigned_to,
        "assignee": public_user(assignee) if assignee else None,
        "created_at": issue.created_at,
        "updated_at": issue.updated_at,
        "comment_count": comment_count,
    }


def list_issues(db, user, pid, status, priority, q, page, page_size, mine=False):
    statement = (
        select(Issue)
        .join(Membership, Issue.project_id == Membership.project_id)
        .where(Membership.user_id == user.id)
    )
    if pid is not None:
        project_access(pid, user, db)
        statement = statement.where(Issue.project_id == pid)
    if status:
        statement = statement.where(Issue.status == status.value)
    if priority:
        statement = statement.where(Issue.priority == priority.value)
    if q:
        statement = statement.where(
            or_(
                Issue.title.icontains(q, autoescape=True),
                Issue.description.icontains(q, autoescape=True),
            )
        )
    if mine:
        statement = statement.where(Issue.assigned_to == user.id)
    total = db.scalar(select(func.count()).select_from(statement.subquery()))
    rows = db.scalars(
        statement.order_by(Issue.created_at.desc(), Issue.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    # Fetch related records once per page instead of once per issue.
    issue_ids = [issue.id for issue in rows]
    project_ids = {issue.project_id for issue in rows}
    assignee_ids = {issue.assigned_to for issue in rows if issue.assigned_to is not None}
    projects = (
        {p.id: p for p in db.scalars(select(Project).where(Project.id.in_(project_ids)))}
        if rows
        else {}
    )
    assignees = (
        {u.id: u for u in db.scalars(select(User).where(User.id.in_(assignee_ids)))}
        if assignee_ids
        else {}
    )
    comment_counts = (
        dict(
            db.execute(
                select(Comment.issue_id, func.count(Comment.id))
                .where(Comment.issue_id.in_(issue_ids))
                .group_by(Comment.issue_id)
            ).all()
        )
        if rows
        else {}
    )
    return {
        "items": [
            issue_json(i, db, projects=projects, assignees=assignees, comment_counts=comment_counts)
            for i in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.get("/issues")
def all_issues(
    db: DB,
    user: CurrentUser,
    status: Status | None = None,
    priority: Priority | None = None,
    q: str = Query(default="", max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    mine: bool = False,
):
    return list_issues(db, user, None, status, priority, q, page, page_size, mine)


@app.get("/projects/{pid}/issues")
def project_issues(
    pid: int,
    db: DB,
    user: CurrentUser,
    status: Status | None = None,
    priority: Priority | None = None,
    q: str = Query(default="", max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
):
    return list_issues(db, user, pid, status, priority, q, page, page_size)


@app.post("/projects/{pid}/issues", status_code=201)
def create_issue(pid: int, data: IssueInput, db: DB, user: CurrentUser):
    project_access(pid, user, db)
    validate_assignee(pid, data.assigned_to, db)
    issue = Issue(**data.model_dump(mode="json"), project_id=pid, created_by=user.id)
    db.add(issue)
    db.commit()
    return issue_json(issue, db)


def issue_access(iid, user, db):
    issue = db.get(Issue, iid)
    if not issue:
        raise HTTPException(404, "Issue not found")
    project_access(issue.project_id, user, db)
    return issue


@app.get("/issues/{iid}")
def get_issue(iid: int, db: DB, user: CurrentUser):
    return issue_json(issue_access(iid, user, db), db)


@app.patch("/issues/{iid}")
def update_issue(iid: int, data: IssuePatch, db: DB, user: CurrentUser):
    issue = issue_access(iid, user, db)
    changes = data.model_dump(exclude_unset=True, mode="json")
    if "assigned_to" in changes:
        validate_assignee(issue.project_id, changes["assigned_to"], db)
    for field, value in changes.items():
        setattr(issue, field, value)
    db.commit()
    return issue_json(issue, db)


@app.delete("/issues/{iid}", status_code=204)
def delete_issue(iid: int, db: DB, user: CurrentUser):
    db.delete(issue_access(iid, user, db))
    db.commit()


def comment_json(comment, db):
    return {
        "id": comment.id,
        "body": comment.body,
        "author": public_user(db.get(User, comment.author_id)),
        "created_at": comment.created_at,
    }


@app.get("/issues/{iid}/comments")
def comments(iid: int, db: DB, user: CurrentUser):
    issue_access(iid, user, db)
    return [
        comment_json(c, db)
        for c in db.scalars(
            select(Comment).where(Comment.issue_id == iid).order_by(Comment.created_at, Comment.id)
        )
    ]


@app.post("/issues/{iid}/comments", status_code=201)
def add_comment(iid: int, data: CommentInput, db: DB, user: CurrentUser):
    issue_access(iid, user, db)
    comment = Comment(body=data.body, issue_id=iid, author_id=user.id)
    db.add(comment)
    db.commit()
    return comment_json(comment, db)


@app.get("/dashboard")
def dashboard(db: DB, user: CurrentUser):
    base = (
        select(Issue)
        .join(Membership, Issue.project_id == Membership.project_id)
        .where(Membership.user_id == user.id)
        .subquery()
    )
    statuses = dict(db.execute(select(base.c.status, func.count()).group_by(base.c.status)).all())
    priorities = dict(
        db.execute(select(base.c.priority, func.count()).group_by(base.c.priority)).all()
    )
    total = sum(statuses.values())
    return {
        "total": total,
        "open": total - statuses.get("Done", 0),
        "completed": statuses.get("Done", 0),
        "in_progress": statuses.get("In Progress", 0),
        "by_priority": {p.value: priorities.get(p.value, 0) for p in Priority},
        "by_status": {s.value: statuses.get(s.value, 0) for s in Status},
    }
