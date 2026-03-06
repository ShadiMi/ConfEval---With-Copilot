"""Unit tests for Pydantic schemas (validation logic)."""

import pytest
from pydantic import ValidationError

from app.schemas import (
    UserCreate,
    UserUpdate,
    ProjectCreate,
    CriteriaCreate,
    ConferenceBase,
    LoginRequest,
    CriteriaScoreCreate,
    ReviewCreate,
    TagCreate,
    SessionCreate,
    ALLOWED_BUILDINGS,
    allowed_rooms_for_floor,
)
from app.models import UserRole
from datetime import datetime, timedelta


# ── UserCreate validation ────────────────────────────────────────


class TestUserCreate:
    valid_data = {
        "email": "test@example.com",
        "full_name": "Test User",
        "password": "Valid1pass",
        "role": UserRole.STUDENT,
    }

    def test_valid_creation(self):
        user = UserCreate(**self.valid_data)
        assert user.email == "test@example.com"

    def test_password_needs_uppercase(self):
        with pytest.raises(ValidationError, match="uppercase"):
            UserCreate(**{**self.valid_data, "password": "nouppercase1"})

    def test_password_needs_lowercase(self):
        with pytest.raises(ValidationError, match="lowercase"):
            UserCreate(**{**self.valid_data, "password": "NOLOWERCASE1"})

    def test_password_needs_digit(self):
        with pytest.raises(ValidationError, match="digit"):
            UserCreate(**{**self.valid_data, "password": "NoDigitHere"})

    def test_password_min_length(self):
        with pytest.raises(ValidationError):
            UserCreate(**{**self.valid_data, "password": "Ab1"})

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            UserCreate(**{**self.valid_data, "email": "not-an-email"})

    def test_id_number_must_be_9_digits(self):
        with pytest.raises(ValidationError):
            UserCreate(**{**self.valid_data, "id_number": "12345"})

    def test_valid_id_number(self):
        user = UserCreate(**{**self.valid_data, "id_number": "123456789"})
        assert user.id_number == "123456789"

    def test_full_name_min_length(self):
        with pytest.raises(ValidationError):
            UserCreate(**{**self.valid_data, "full_name": "A"})


# ── ProjectCreate validation ─────────────────────────────────────


class TestProjectCreate:
    def test_valid_project(self):
        p = ProjectCreate(title="My Project", description="Desc")
        assert p.title == "My Project"
        assert p.tag_ids == []
        assert p.team_member_emails == []

    def test_max_team_members(self):
        with pytest.raises(ValidationError, match="Maximum 2"):
            ProjectCreate(
                title="P",
                team_member_emails=[
                    "a@test.com",
                    "b@test.com",
                    "c@test.com",
                ],
            )

    def test_deduplicates_team_emails(self):
        p = ProjectCreate(
            title="P",
            team_member_emails=["a@test.com", "A@test.com"],
        )
        assert len(p.team_member_emails) == 1

    def test_title_required(self):
        with pytest.raises(ValidationError):
            ProjectCreate(title="")


# ── CriteriaCreate validation ────────────────────────────────────


class TestCriteriaCreate:
    def test_valid_criteria(self):
        c = CriteriaCreate(name="Quality", session_id=1)
        assert c.max_score == 100
        assert c.weight == 1.0

    def test_max_score_out_of_range(self):
        with pytest.raises(ValidationError):
            CriteriaCreate(name="Q", session_id=1, max_score=101)

    def test_weight_out_of_range(self):
        with pytest.raises(ValidationError):
            CriteriaCreate(name="Q", session_id=1, weight=0.05)


# ── Conference building/floor/room ────────────────────────────────


class TestConferenceValidation:
    base = {
        "name": "Conf",
        "start_date": datetime.utcnow() + timedelta(days=1),
        "end_date": datetime.utcnow() + timedelta(days=2),
    }

    def test_valid_building(self):
        c = ConferenceBase(**{**self.base, "building": "ספרא"})
        assert c.building == "ספרא"

    def test_invalid_building(self):
        with pytest.raises(ValidationError, match="Invalid building"):
            ConferenceBase(**{**self.base, "building": "Unknown"})

    def test_valid_floor(self):
        c = ConferenceBase(**{**self.base, "floor": 1})
        assert c.floor == 1

    def test_invalid_floor(self):
        with pytest.raises(ValidationError, match="floor must be 1 or 2"):
            ConferenceBase(**{**self.base, "floor": 3})

    def test_valid_room_floor1(self):
        c = ConferenceBase(**{**self.base, "floor": 1, "room_number": 105})
        assert c.room_number == 105

    def test_invalid_room_for_floor(self):
        with pytest.raises(ValidationError):
            ConferenceBase(**{**self.base, "floor": 1, "room_number": 201})

    def test_allowed_rooms_for_floor_helper(self):
        assert allowed_rooms_for_floor(1) == list(range(101, 110))
        assert allowed_rooms_for_floor(2) == list(range(201, 210))
        assert allowed_rooms_for_floor(3) == []


# ── Tag schemas ───────────────────────────────────────────────────


class TestTagCreate:
    def test_valid_tag(self):
        t = TagCreate(name="AI")
        assert t.name == "AI"

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            TagCreate(name="")


# ── Session schemas ───────────────────────────────────────────────


class TestSessionCreate:
    def test_valid_session(self):
        s = SessionCreate(
            name="Morning Session",
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow() + timedelta(hours=2),
        )
        assert s.max_projects == 50

    def test_name_required(self):
        with pytest.raises(ValidationError):
            SessionCreate(
                name="",
                start_date=datetime.utcnow(),
                end_date=datetime.utcnow(),
            )


# ── Review / CriteriaScore schemas ───────────────────────────────


class TestReviewCreate:
    def test_valid_review(self):
        r = ReviewCreate(
            project_id=1,
            comments="Good work",
            criteria_scores=[CriteriaScoreCreate(criteria_id=1, score=85)],
        )
        assert len(r.criteria_scores) == 1

    def test_score_must_be_non_negative(self):
        with pytest.raises(ValidationError):
            CriteriaScoreCreate(criteria_id=1, score=-5)
