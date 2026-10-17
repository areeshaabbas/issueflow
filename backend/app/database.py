from datetime import datetime, timezone
from sqlalchemy import create_engine, event, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from pydantic_settings import BaseSettings, SettingsConfigDict
import secrets
import os
from sqlalchemy.pool import NullPool


class Settings(BaseSettings):
    database_url: str = "sqlite:///./issueflow.db"
    jwt_secret: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cookie_secure: bool = False
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
is_vercel = os.getenv("VERCEL") == "1"
if is_vercel:
    if not settings.database_url.startswith(
        ("postgres://", "postgresql://", "postgresql+psycopg://")
    ):
        raise RuntimeError(
            "Set DATABASE_URL to your hosted PostgreSQL connection string before deploying."
        )
    if len(settings.jwt_secret) < 32:
        raise RuntimeError("Set JWT_SECRET to a stable random secret with at least 32 characters.")
    settings.cookie_secure = True
    deployment_hosts = [os.getenv("VERCEL_URL"), os.getenv("VERCEL_PROJECT_PRODUCTION_URL")]
    settings.cors_origins = ",".join(
        dict.fromkeys(
            settings.cors_origins.split(",")
            + ["https://" + host for host in deployment_hosts if host]
        )
    )

# Neon provides a standard PostgreSQL URL; select the installed psycopg driver.
for prefix in ("postgres://", "postgresql://"):
    if settings.database_url.startswith(prefix):
        settings.database_url = "postgresql+psycopg://" + settings.database_url[len(prefix) :]
        break
# Local development can start without setup. Deployment must supply a stable secret.
if not settings.jwt_secret:
    settings.jwt_secret = secrets.token_urlsafe(48)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    pool_pre_ping=True,
    **({"poolclass": NullPool} if is_vercel else {})
)
if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=now)


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)


class Issue(Base):
    __tablename__ = "issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="Todo", index=True)
    priority: Mapped[str] = mapped_column(String(20), default="Medium", index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(default=now)
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)


class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[int] = mapped_column(primary_key=True)
    body: Mapped[str] = mapped_column(Text)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=now)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime]


def get_db():
    with SessionLocal() as db:
        yield db
