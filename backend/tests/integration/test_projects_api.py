"""Integration tests for /api/projects endpoints."""

import pytest
from tests.conftest import (
    make_user, make_admin, make_reviewer, make_session,
    make_project, make_tag, auth_header,
)
from app.models import ProjectStatus


class TestListProjects:
    def test_admin_sees_all_projects(self, client, db):
        admin = make_admin(db)
        student = make_user(db, email="s@test.com")
        make_project(db, student=student)
        resp = client.get("/api/projects", headers=auth_header(admin))
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_student_sees_own_projects(self, client, db):
        student = make_user(db)
        make_project(db, student=student)
        resp = client.get("/api/projects/my", headers=auth_header(student))
        assert resp.status_code == 200
        projects = resp.json()
        assert len(projects) >= 1
        assert all(p["student_id"] == student.id for p in projects)


class TestCreateProject:
    def test_student_creates_project(self, client, db):
        student = make_user(db)
        sess = make_session(db)
        resp = client.post(
            "/api/projects",
            headers=auth_header(student),
            json={
                "title": "My Research",
                "description": "Description here",
                "session_id": sess.id,
            },
        )
        assert resp.status_code == 201
        assert resp.json()["title"] == "My Research"

    def test_reviewer_cannot_create_project(self, client, db):
        rev = make_reviewer(db)
        resp = client.post(
            "/api/projects",
            headers=auth_header(rev),
            json={"title": "Not allowed"},
        )
        assert resp.status_code == 403


class TestProjectStatus:
    def test_admin_approves_project(self, client, db):
        admin = make_admin(db)
        student = make_user(db, email="s@test.com")
        proj = make_project(db, student=student)
        resp = client.put(
            f"/api/projects/{proj.id}/status",
            headers=auth_header(admin),
            json={"status": "approved"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

    def test_student_cannot_approve(self, client, db):
        student = make_user(db)
        proj = make_project(db, student=student)
        resp = client.put(
            f"/api/projects/{proj.id}/status",
            headers=auth_header(student),
            json={"status": "approved"},
        )
        assert resp.status_code == 403


class TestGetProject:
    def test_get_existing_project(self, client, db):
        admin = make_admin(db)
        student = make_user(db, email="s@test.com")
        proj = make_project(db, student=student)
        resp = client.get(f"/api/projects/{proj.id}", headers=auth_header(admin))
        assert resp.status_code == 200

    def test_get_nonexistent_project(self, client, db):
        admin = make_admin(db)
        resp = client.get("/api/projects/9999", headers=auth_header(admin))
        assert resp.status_code == 404
