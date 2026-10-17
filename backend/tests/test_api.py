import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "testing-only-secret-with-at-least-32-characters"
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db, User
from app.main import app


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)

    def override():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override
    with TestClient(app, headers={"Origin": "http://localhost:5173"}) as c:
        yield c, factory
    app.dependency_overrides.clear()
    engine.dispose()


def register(c, email="owner@example.com", name="Areesha"):
    r = c.post(
        "/auth/register", json={"name": name, "email": email, "password": "strong-password-123"}
    )
    assert r.status_code == 201, r.text
    return r.json()["user"]


def project(c):
    r = c.post(
        "/projects", json={"name": "Website redesign", "description": "Build a better experience"}
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def issue(c, pid, **kwargs):
    r = c.post(f"/projects/{pid}/issues", json={"title": "Fix the login redirect", **kwargs})
    assert r.status_code == 201, r.text
    return r.json()


def test_auth_hash_login_logout_revocation(client):
    c, factory = client
    user = register(c)
    token = c.cookies.get("issueflow_session")
    with factory() as db:
        stored = db.get(User, user["id"])
        assert stored.password_hash != "strong-password-123"
        assert stored.password_hash.startswith("$argon2")
    assert c.get("/auth/me").json()["id"] == user["id"]
    assert c.post("/auth/logout").status_code == 204
    assert c.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert (
        c.post("/auth/login", json={"email": user["email"], "password": "wrong"}).status_code == 401
    )
    assert (
        c.post(
            "/auth/login", json={"email": user["email"], "password": "strong-password-123"}
        ).status_code
        == 200
    )


def test_duplicate_and_invalid_registration(client):
    c, _ = client
    register(c)
    assert (
        c.post(
            "/auth/register",
            json={
                "name": "Areesha",
                "email": "owner@example.com",
                "password": "strong-password-123",
            },
        ).status_code
        == 409
    )
    assert (
        c.post(
            "/auth/register", json={"name": "A", "email": "invalid", "password": "short"}
        ).status_code
        == 422
    )


def test_project_issue_comment_lifecycle_and_dashboard(client):
    c, _ = client
    user = register(c)
    pid = project(c)
    i = issue(c, pid, priority="Critical", assigned_to=user["id"])
    assert i["status"] == "Todo"
    iid = i["id"]
    assert (
        c.patch(f"/issues/{iid}", json={"status": "In Progress"}).json()["status"] == "In Progress"
    )
    assert (
        c.post(f"/issues/{iid}/comments", json={"body": "Reproduced in Safari."}).status_code == 201
    )
    comment = c.get(f"/issues/{iid}/comments").json()[0]
    assert comment["author"]["name"] == "Areesha"
    assert comment["created_at"]
    assert c.get("/dashboard").json()["by_priority"]["Critical"] == 1
    assert c.get("/dashboard").json()["in_progress"] == 1
    assert c.patch(f"/issues/{iid}", json={"status": "Done"}).status_code == 200
    assert c.get("/dashboard").json()["completed"] == 1
    assert c.get("/dashboard").json()["open"] == 0
    assert (
        c.patch(
            f"/projects/{pid}", json={"name": "Updated project", "description": "New scope"}
        ).status_code
        == 200
    )
    assert c.delete(f"/projects/{pid}").status_code == 204
    assert c.get(f"/issues/{iid}").status_code == 404
    assert c.get("/dashboard").json()["total"] == 0


def test_outsider_cannot_access_or_change_project(client):
    c, _ = client
    register(c)
    pid = project(c)
    i = issue(c, pid)
    c.post("/auth/logout")
    register(c, "outsider@example.com", "Other User")
    assert c.get("/projects").json() == []
    assert c.get("/issues").json()["total"] == 0
    assert c.get("/dashboard").json()["total"] == 0
    for method, path, data in [
        ("GET", f"/projects/{pid}", None),
        ("PATCH", f'/issues/{i["id"]}', {"title": "Unauthorized change"}),
        ("DELETE", f"/projects/{pid}", None),
        ("POST", f'/issues/{i["id"]}/comments', {"body": "Unauthorized comment"}),
        ("GET", f'/issues/{i["id"]}/comments', None),
    ]:
        assert c.request(method, path, json=data).status_code == 404


def test_membership_assignment_and_owner_permissions(client):
    c, _ = client
    owner = register(c)
    pid = project(c)
    c.post("/auth/logout")
    teammate = register(c, "teammate@example.com", "Team Member")
    c.post("/auth/logout")
    c.post("/auth/login", json={"email": owner["email"], "password": "strong-password-123"})
    assert c.post(f"/projects/{pid}/members", json={"email": teammate["email"]}).status_code == 201
    assert c.post(f"/projects/{pid}/members", json={"email": teammate["email"]}).status_code == 409
    assert (
        c.post(f"/projects/{pid}/members", json={"email": "missing@example.com"}).status_code == 404
    )
    i = issue(c, pid, assigned_to=teammate["id"])
    c.post("/auth/logout")
    c.post("/auth/login", json={"email": teammate["email"], "password": "strong-password-123"})
    assert c.get("/issues?mine=true").json()["total"] == 1
    assert c.patch(f'/issues/{i["id"]}', json={"status": "Done"}).status_code == 200
    assert c.delete(f"/projects/{pid}").status_code == 403
    assert (
        c.patch(f"/projects/{pid}", json={"name": "No access", "description": ""}).status_code
        == 403
    )
    assert (
        c.post(f"/projects/{pid}/members", json={"email": "someone@example.com"}).status_code == 403
    )


def test_invalid_issue_fields_and_assignee(client):
    c, _ = client
    register(c)
    pid = project(c)
    for data in [
        {"title": "x"},
        {"title": "Valid title", "status": "Unknown"},
        {"title": "Valid title", "priority": "Urgent"},
        {"title": "Valid title", "assigned_to": 999},
        {"title": "   "},
    ]:
        assert c.post(f"/projects/{pid}/issues", json=data).status_code == 422
    i = issue(c, pid)
    assert c.patch(f'/issues/{i["id"]}', json={"title": None}).status_code == 422
    assert c.patch(f'/issues/{i["id"]}', json={"status": None}).status_code == 422
    assert c.patch(f'/issues/{i["id"]}', json={"assigned_to": None}).status_code == 200
    assert c.post(f'/issues/{i["id"]}/comments', json={"body": "  "}).status_code == 422


def test_search_filters_and_pagination(client):
    c, _ = client
    register(c)
    pid = project(c)
    issue(c, pid, priority="High", status="In Progress")
    c.post(f"/projects/{pid}/issues", json={"title": "Update documentation", "priority": "Low"})
    assert c.get(f"/projects/{pid}/issues?q=LOGIN&priority=High").json()["total"] == 1
    assert c.get("/issues?status=Done").json()["total"] == 0
    first = c.get("/issues?page_size=1&page=1").json()
    second = c.get("/issues?page_size=1&page=2").json()
    assert first["total"] == 2
    assert first["items"][0]["id"] != second["items"][0]["id"]
    assert c.get("/issues?page=0").status_code == 422
    assert c.get("/issues?q=%25").json()["total"] == 0


def test_cookie_csrf_and_protected_routes(client):
    c, _ = client
    assert c.get("/projects").status_code == 401
    register(c)
    assert (
        c.post(
            "/projects", json={"name": "Blocked"}, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    token = c.cookies.get("issueflow_session")
    assert (
        c.post(
            "/projects",
            json={"name": "API client"},
            headers={"Authorization": f"Bearer {token}", "Origin": "https://evil.example"},
        ).status_code
        == 201
    )


def test_delete_issue_cascades_comments(client):
    c, _ = client
    register(c)
    pid = project(c)
    i = issue(c, pid)
    c.post(f'/issues/{i["id"]}/comments', json={"body": "Delete with issue"})
    assert c.delete(f'/issues/{i["id"]}').status_code == 204
    assert c.get(f'/issues/{i["id"]}/comments').status_code == 404
    assert c.get(f"/projects/{pid}").json()["total_issues"] == 0


def test_password_spaces_are_preserved(client):
    c, _ = client
    password = "  significant password spaces  "
    assert (
        c.post(
            "/auth/register",
            json={
                "name": "Whitespace Test",
                "email": "spaces@example.com",
                "password": password,
            },
        ).status_code
        == 201
    )
    assert c.post("/auth/logout").status_code == 204
    assert (
        c.post(
            "/auth/login",
            json={
                "email": "spaces@example.com",
                "password": password.strip(),
            },
        ).status_code
        == 401
    )
    assert (
        c.post(
            "/auth/login",
            json={
                "email": "spaces@example.com",
                "password": password,
            },
        ).status_code
        == 200
    )


def test_issue_page_query_count_does_not_grow_per_row(client):
    from sqlalchemy import event

    c, factory = client
    user = register(c)
    pid = project(c)
    first = issue(c, pid, assigned_to=user["id"])
    c.post(f'/issues/{first["id"]}/comments', json={"body": "Count this comment"})
    engine = factory.kw["bind"]
    queries = []

    def record(_connection, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            queries.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        assert c.get("/issues").json()["items"][0]["comment_count"] == 1
        one_row_queries = len(queries)
        for number in range(12):
            issue(c, pid, title=f"Pagination regression {number}", assigned_to=user["id"])
        queries.clear()
        response = c.get("/issues").json()
        assert response["total"] == 13
        assert all(row["assignee"]["id"] == user["id"] for row in response["items"])
        assert len(queries) <= one_row_queries + 1
    finally:
        event.remove(engine, "before_cursor_execute", record)
