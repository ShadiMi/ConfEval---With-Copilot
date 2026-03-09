"""Integration tests for /api/auth endpoints."""

from tests.conftest import make_user, make_reviewer, auth_header


class TestRegister:
    def test_register_student(self, client, db):
        resp = client.post(
            "/api/auth/register",
            data={
                "email": "new@test.com",
                "password": "Valid1pass",
                "full_name": "New Student",
                "role": "student",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["email"] == "new@test.com"
        assert body["role"] == "student"
        assert body["is_approved"] is True  # students auto-approved

    def test_register_duplicate_email(self, client, db):
        make_user(db, email="dup@test.com")
        resp = client.post(
            "/api/auth/register",
            data={
                "email": "dup@test.com",
                "password": "Valid1pass",
                "full_name": "Dup",
                "role": "student",
            },
        )
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"]

    def test_register_invalid_role(self, client, db):
        resp = client.post(
            "/api/auth/register",
            data={
                "email": "bad@test.com",
                "password": "Valid1pass",
                "full_name": "Bad",
                "role": "superuser",
            },
        )
        assert resp.status_code == 400

    def test_register_reviewer_needs_approval(self, client, db):
        resp = client.post(
            "/api/auth/register",
            data={
                "email": "rev@test.com",
                "password": "Valid1pass",
                "full_name": "Reviewer",
                "role": "internal_reviewer",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["is_approved"] is False

    def test_register_invalid_id_number(self, client, db):
        resp = client.post(
            "/api/auth/register",
            data={
                "email": "id@test.com",
                "password": "Valid1pass",
                "full_name": "ID User",
                "role": "student",
                "id_number": "123",  # too short
            },
        )
        assert resp.status_code == 400


class TestLogin:
    def test_login_success(self, client, db):
        make_user(db, email="login@test.com", password="Valid1pass")
        resp = client.post(
            "/api/auth/login",
            json={"email": "login@test.com", "password": "Valid1pass"},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_wrong_password(self, client, db):
        make_user(db, email="wp@test.com", password="Valid1pass")
        resp = client.post(
            "/api/auth/login",
            json={"email": "wp@test.com", "password": "WrongPass1"},
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client, db):
        resp = client.post(
            "/api/auth/login",
            json={"email": "ghost@test.com", "password": "Whatever1"},
        )
        assert resp.status_code == 401

    def test_login_inactive_user(self, client, db):
        make_user(db, email="inactive@test.com", password="Valid1pass", is_active=False)
        resp = client.post(
            "/api/auth/login",
            json={"email": "inactive@test.com", "password": "Valid1pass"},
        )
        assert resp.status_code == 403

    def test_login_unapproved_reviewer(self, client, db):
        make_reviewer(
            db, email="unapp@test.com", password="Valid1pass", is_approved=False
        )
        resp = client.post(
            "/api/auth/login",
            json={"email": "unapp@test.com", "password": "Valid1pass"},
        )
        assert resp.status_code == 403
        assert "pending approval" in resp.json()["detail"]


class TestGetMe:
    def test_get_profile(self, client, db):
        user = make_user(db)
        resp = client.get("/api/auth/me", headers=auth_header(user))
        assert resp.status_code == 200
        assert resp.json()["email"] == user.email

    def test_unauthenticated(self, client, db):
        resp = client.get("/api/auth/me")
        assert resp.status_code in (401, 403)  # no credentials

    def test_invalid_token(self, client, db):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401


class TestUpdateMe:
    def test_update_name(self, client, db):
        user = make_user(db)
        resp = client.put(
            "/api/auth/me",
            headers=auth_header(user),
            json={"full_name": "Updated Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"
