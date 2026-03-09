"""Integration tests for /api/conferences endpoints."""

from datetime import datetime, timedelta
from tests.conftest import make_admin, make_user, make_conference, auth_header
from app.models import ConferenceStatus


class TestListConferences:
    def test_admin_lists_all_conferences(self, client, db):
        admin = make_admin(db)
        make_conference(db, name="Conf A")
        make_conference(db, name="Conf B", status=ConferenceStatus.DRAFT.value)
        resp = client.get("/api/conferences", headers=auth_header(admin))
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    def test_public_conferences(self, client, db):
        make_conference(db, name="Active", status=ConferenceStatus.ACTIVE.value)
        make_conference(db, name="Draft", status=ConferenceStatus.DRAFT.value)
        resp = client.get("/api/conferences/public")
        assert resp.status_code == 200
        # should only show active
        names = [c["name"] for c in resp.json()]
        assert "Active" in names


class TestCreateConference:
    def test_admin_creates_conference(self, client, db):
        admin = make_admin(db)
        resp = client.post(
            "/api/conferences",
            headers=auth_header(admin),
            json={
                "name": "New Conf",
                "start_date": (datetime.utcnow() + timedelta(days=10)).isoformat(),
                "end_date": (datetime.utcnow() + timedelta(days=12)).isoformat(),
            },
        )
        assert resp.status_code == 201

    def test_student_cannot_create_conference(self, client, db):
        student = make_user(db)
        resp = client.post(
            "/api/conferences",
            headers=auth_header(student),
            json={
                "name": "No",
                "start_date": datetime.utcnow().isoformat(),
                "end_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            },
        )
        assert resp.status_code == 403


class TestDeleteConference:
    def test_admin_deletes_conference(self, client, db):
        admin = make_admin(db)
        conf = make_conference(db)
        resp = client.delete(
            f"/api/conferences/{conf.id}", headers=auth_header(admin)
        )
        assert resp.status_code in (200, 204)
