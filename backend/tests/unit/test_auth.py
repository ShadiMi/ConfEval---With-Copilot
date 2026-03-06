"""Unit tests for the auth module (password hashing, JWT tokens, role checks)."""

import pytest
from datetime import timedelta
from unittest.mock import MagicMock, AsyncMock
from fastapi import HTTPException

from app.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token,
    require_admin,
    require_reviewer,
    require_student,
)
from app.models import UserRole


# ── Password hashing ─────────────────────────────────────────────


class TestPasswordHashing:
    def test_hash_and_verify_correct(self):
        pwd = "MyS3cure!Pass"
        hashed = get_password_hash(pwd)
        assert verify_password(pwd, hashed) is True

    def test_verify_wrong_password(self):
        hashed = get_password_hash("correct")
        assert verify_password("wrong", hashed) is False

    def test_hash_is_unique(self):
        h1 = get_password_hash("same")
        h2 = get_password_hash("same")
        assert h1 != h2  # different salts


# ── JWT tokens ────────────────────────────────────────────────────


class TestJWT:
    def test_create_and_decode_token(self):
        data = {"sub": 42, "role": "admin"}
        token = create_access_token(data)
        result = decode_token(token)
        assert result is not None
        assert result.user_id == 42
        assert result.role == "admin"

    def test_decode_expired_token(self):
        token = create_access_token(
            {"sub": 1, "role": "student"},
            expires_delta=timedelta(seconds=-1),
        )
        assert decode_token(token) is None

    def test_decode_invalid_token(self):
        assert decode_token("not.a.real.token") is None

    def test_sub_stored_as_string(self):
        token = create_access_token({"sub": 99, "role": "student"})
        result = decode_token(token)
        assert result.user_id == 99  # decoded back to int

    def test_missing_sub_returns_none(self):
        token = create_access_token({"role": "admin"})
        assert decode_token(token) is None


# ── Role guards (sync wrappers) ──────────────────────────────────


def _mock_user(role: str):
    user = MagicMock()
    user.role = role
    user.is_active = True
    return user


class TestRequireAdmin:
    @pytest.mark.asyncio
    async def test_admin_passes(self):
        user = _mock_user(UserRole.ADMIN.value)
        result = require_admin(current_user=user)
        assert result is user

    @pytest.mark.asyncio
    async def test_non_admin_raises(self):
        user = _mock_user(UserRole.STUDENT.value)
        with pytest.raises(HTTPException) as exc:
            require_admin(current_user=user)
        assert exc.value.status_code == 403


class TestRequireReviewer:
    @pytest.mark.asyncio
    async def test_internal_reviewer_passes(self):
        user = _mock_user(UserRole.INTERNAL_REVIEWER.value)
        result = require_reviewer(current_user=user)
        assert result is user

    @pytest.mark.asyncio
    async def test_external_reviewer_passes(self):
        user = _mock_user(UserRole.EXTERNAL_REVIEWER.value)
        result = require_reviewer(current_user=user)
        assert result is user

    @pytest.mark.asyncio
    async def test_student_rejected(self):
        user = _mock_user(UserRole.STUDENT.value)
        with pytest.raises(HTTPException) as exc:
            require_reviewer(current_user=user)
        assert exc.value.status_code == 403


class TestRequireStudent:
    @pytest.mark.asyncio
    async def test_student_passes(self):
        user = _mock_user(UserRole.STUDENT.value)
        result = require_student(current_user=user)
        assert result is user

    @pytest.mark.asyncio
    async def test_admin_rejected(self):
        user = _mock_user(UserRole.ADMIN.value)
        with pytest.raises(HTTPException) as exc:
            require_student(current_user=user)
        assert exc.value.status_code == 403
