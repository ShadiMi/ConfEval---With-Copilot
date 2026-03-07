"""Integration tests for /api/health and /api/stats endpoints."""

import pytest
from tests.conftest import make_user, make_session, make_project


class TestHealthCheck:
    def test_health_returns_200(self, client, db):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


class TestStats:
    def test_stats_returns_counts(self, client, db):
        student = make_user(db)
        make_session(db)
        make_project(db, student=student)
        resp = client.get("/api/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_users" in data
        assert "total_sessions" in data
        assert "total_projects" in data
        assert "total_reviews" in data
