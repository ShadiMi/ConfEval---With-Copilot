"""
Shared test fixtures for backend tests.
Uses an in-memory SQLite database for isolation.
"""
import os
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Override DATABASE_URL before importing app modules
os.environ["DATABASE_URL"] = "sqlite://"

from app.database import Base, get_db
from app.models import (
    User, UserRole, Tag, Conference, Session, Project,
    Criteria, Review, CriteriaScore, ReviewerApplication,
    Notification, ConferenceStatus, SessionStatus, ProjectStatus,
    ApplicationStatus, NotificationType,
)
from app.auth import get_password_hash, create_access_token
from main import app

# In-memory SQLite for tests
TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


@pytest.fixture(autouse=True)
def db():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture()
def client(db):
    """FastAPI TestClient with overridden DB dependency."""
    def _override():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Helper factories ──────────────────────────────────────────────


def make_user(
    db,
    *,
    email="user@test.com",
    full_name="Test User",
    role=UserRole.STUDENT.value,
    password="Test1234",
    is_active=True,
    is_approved=True,
) -> User:
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=get_password_hash(password),
        role=role,
        is_active=is_active,
        is_approved=is_approved,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_admin(db, **kw) -> User:
    kw.setdefault("email", "admin@test.com")
    kw.setdefault("full_name", "Admin User")
    return make_user(db, role=UserRole.ADMIN.value, **kw)


def make_reviewer(db, *, internal=True, **kw) -> User:
    role = UserRole.INTERNAL_REVIEWER.value if internal else UserRole.EXTERNAL_REVIEWER.value
    kw.setdefault("email", "reviewer@test.com")
    kw.setdefault("full_name", "Reviewer User")
    return make_user(db, role=role, **kw)


def make_token(user: User) -> str:
    return create_access_token(data={"sub": user.id, "role": user.role})


def auth_header(user: User) -> dict:
    return {"Authorization": f"Bearer {make_token(user)}"}


def make_conference(db, **kw) -> Conference:
    defaults = dict(
        name="Test Conference",
        description="A test conference",
        start_date=datetime.utcnow() + timedelta(days=1),
        end_date=datetime.utcnow() + timedelta(days=2),
        status=ConferenceStatus.ACTIVE.value,
    )
    defaults.update(kw)
    conf = Conference(**defaults)
    db.add(conf)
    db.commit()
    db.refresh(conf)
    return conf


def make_session(db, conference=None, **kw) -> Session:
    if conference is None:
        conference = make_conference(db)
    defaults = dict(
        name="Test Session",
        description="A test session",
        conference_id=conference.id,
        start_date=datetime.utcnow() + timedelta(days=1),
        end_date=datetime.utcnow() + timedelta(days=1, hours=2),
        status=SessionStatus.UPCOMING.value,
    )
    defaults.update(kw)
    sess = Session(**defaults)
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return sess


def make_project(db, student=None, session=None, **kw) -> Project:
    if student is None:
        student = make_user(db)
    defaults = dict(
        title="Test Project",
        description="A test project",
        student_id=student.id,
        session_id=session.id if session else None,
        status=ProjectStatus.PENDING.value,
    )
    defaults.update(kw)
    proj = Project(**defaults)
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj


def make_tag(db, name="Machine Learning", **kw) -> Tag:
    tag = Tag(name=name, **kw)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


def make_criteria(db, session, **kw) -> Criteria:
    defaults = dict(
        session_id=session.id,
        name="Presentation Quality",
        max_score=100,
        weight=1.0,
        order=0,
    )
    defaults.update(kw)
    c = Criteria(**defaults)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c
