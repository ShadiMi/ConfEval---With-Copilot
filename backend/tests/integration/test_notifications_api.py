"""Integration tests for /api/notifications endpoints."""

import pytest
from tests.conftest import make_user, auth_header
from app.models import Notification, NotificationType


class TestNotifications:
    def _create_notification(self, db, user_id):
        n = Notification(
            user_id=user_id,
            type=NotificationType.GENERAL.value,
            title="Test",
            message="Test notification",
            is_read=False,
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        return n

    def test_list_notifications(self, client, db):
        user = make_user(db)
        self._create_notification(db, user.id)
        resp = client.get("/api/notifications", headers=auth_header(user))
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_unread_count(self, client, db):
        user = make_user(db)
        self._create_notification(db, user.id)
        self._create_notification(db, user.id)
        resp = client.get(
            "/api/notifications/unread-count", headers=auth_header(user)
        )
        assert resp.status_code == 200
        assert resp.json()["unread_count"] >= 2

    def test_mark_as_read(self, client, db):
        user = make_user(db)
        n = self._create_notification(db, user.id)
        resp = client.put(
            f"/api/notifications/{n.id}/read", headers=auth_header(user)
        )
        assert resp.status_code == 200

    def test_mark_all_read(self, client, db):
        user = make_user(db)
        self._create_notification(db, user.id)
        self._create_notification(db, user.id)
        resp = client.put(
            "/api/notifications/mark-all-read", headers=auth_header(user)
        )
        assert resp.status_code == 200

    def test_delete_notification(self, client, db):
        user = make_user(db)
        n = self._create_notification(db, user.id)
        resp = client.delete(
            f"/api/notifications/{n.id}", headers=auth_header(user)
        )
        assert resp.status_code in (200, 204)
