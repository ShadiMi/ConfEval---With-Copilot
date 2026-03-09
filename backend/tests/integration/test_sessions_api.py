"""Integration tests for /api/sessions endpoints."""

from datetime import datetime, timedelta
from tests.conftest import (
    make_admin, make_user, make_conference,
    make_session, auth_header,
)
from app.models import SessionStatus


class TestListSessions:
    def test_list_sessions(self, client, db):
        admin = make_admin(db)
        make_session(db)
        resp = client.get("/api/sessions", headers=auth_header(admin))
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


class TestCreateSession:
    def test_admin_creates_session(self, client, db):
        admin = make_admin(db)
        conf = make_conference(db)
        resp = client.post(
            "/api/sessions",
            headers=auth_header(admin),
            json={
                "name": "New Session",
                "start_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
                "end_date": (datetime.utcnow() + timedelta(days=1, hours=2)).isoformat(),
                "conference_id": conf.id,
            },
        )
        assert resp.status_code == 201

    def test_student_cannot_create_session(self, client, db):
        student = make_user(db)
        resp = client.post(
            "/api/sessions",
            headers=auth_header(student),
            json={
                "name": "Nope",
                "start_date": datetime.utcnow().isoformat(),
                "end_date": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            },
        )
        assert resp.status_code == 403


class TestGetSession:
    def test_get_session_details(self, client, db):
        admin = make_admin(db)
        sess = make_session(db)
        resp = client.get(f"/api/sessions/{sess.id}", headers=auth_header(admin))
        assert resp.status_code == 200
        assert resp.json()["id"] == sess.id

    def test_get_nonexistent_session(self, client, db):
        admin = make_admin(db)
        resp = client.get("/api/sessions/9999", headers=auth_header(admin))
        assert resp.status_code == 404


class TestPublicSessions:
    def test_public_sessions_no_auth(self, client, db):
        make_session(db, status=SessionStatus.ACTIVE.value)
        resp = client.get("/api/sessions/public")
        assert resp.status_code == 200
