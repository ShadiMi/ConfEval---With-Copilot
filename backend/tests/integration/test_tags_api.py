"""Integration tests for /api/tags endpoints."""

from tests.conftest import make_admin, make_user, make_tag, auth_header


class TestListTags:
    def test_list_tags_public(self, client, db):
        make_tag(db, name="AI")
        make_tag(db, name="ML")
        resp = client.get("/api/tags")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2


class TestCreateTag:
    def test_admin_creates_tag(self, client, db):
        admin = make_admin(db)
        resp = client.post(
            "/api/tags",
            headers=auth_header(admin),
            json={"name": "Deep Learning", "description": "Neural nets"},
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Deep Learning"

    def test_student_cannot_create_tag(self, client, db):
        student = make_user(db)
        resp = client.post(
            "/api/tags",
            headers=auth_header(student),
            json={"name": "Blocked"},
        )
        assert resp.status_code == 403

    def test_duplicate_tag_rejected(self, client, db):
        admin = make_admin(db)
        make_tag(db, name="Unique")
        resp = client.post(
            "/api/tags",
            headers=auth_header(admin),
            json={"name": "Unique"},
        )
        assert resp.status_code == 400


class TestDeleteTag:
    def test_admin_deletes_tag(self, client, db):
        admin = make_admin(db)
        tag = make_tag(db, name="ToDelete")
        resp = client.delete(f"/api/tags/{tag.id}", headers=auth_header(admin))
        assert resp.status_code in (200, 204)

    def test_delete_nonexistent_tag(self, client, db):
        admin = make_admin(db)
        resp = client.delete("/api/tags/9999", headers=auth_header(admin))
        assert resp.status_code == 404
