"""Unit tests for SQLAlchemy models (table creation, relationships, enum values)."""

import pytest
from tests.conftest import (
    make_user, make_admin, make_reviewer, make_tag,
    make_conference, make_session, make_project, make_criteria,
)
from app.models import (
    UserRole, Review, CriteriaScore,
    ConferenceStatus, SessionStatus, ProjectStatus,
    NotificationType,
)


class TestUserModel:
    def test_create_student(self, db):
        user = make_user(db)
        assert user.id is not None
        assert user.role == UserRole.STUDENT.value
        assert user.is_active is True

    def test_create_admin(self, db):
        admin = make_admin(db)
        assert admin.role == UserRole.ADMIN.value

    def test_create_reviewer(self, db):
        rev = make_reviewer(db)
        assert rev.role == UserRole.INTERNAL_REVIEWER.value

    def test_email_unique(self, db):
        make_user(db, email="dupe@test.com")
        with pytest.raises(Exception):  # IntegrityError
            make_user(db, email="dupe@test.com")


class TestTagModel:
    def test_create_tag(self, db):
        tag = make_tag(db, name="AI")
        assert tag.id is not None
        assert tag.name == "AI"

    def test_tag_name_unique(self, db):
        make_tag(db, name="AI")
        with pytest.raises(Exception):
            make_tag(db, name="AI")


class TestConferenceModel:
    def test_create_conference(self, db):
        conf = make_conference(db)
        assert conf.id is not None
        assert conf.status == ConferenceStatus.ACTIVE.value


class TestSessionModel:
    def test_session_belongs_to_conference(self, db):
        conf = make_conference(db)
        sess = make_session(db, conference=conf)
        assert sess.conference_id == conf.id

    def test_session_default_status(self, db):
        sess = make_session(db)
        assert sess.status == SessionStatus.UPCOMING.value


class TestProjectModel:
    def test_project_belongs_to_student(self, db):
        student = make_user(db)
        proj = make_project(db, student=student)
        assert proj.student_id == student.id

    def test_project_default_status(self, db):
        proj = make_project(db)
        assert proj.status == ProjectStatus.PENDING.value


class TestCriteriaModel:
    def test_criteria_belongs_to_session(self, db):
        sess = make_session(db)
        crit = make_criteria(db, session=sess)
        assert crit.session_id == sess.id
        assert crit.max_score == 100


class TestReviewModel:
    def test_create_review_with_scores(self, db):
        reviewer = make_reviewer(db)
        student = make_user(db, email="student@test.com")
        sess = make_session(db)
        proj = make_project(db, student=student, session=sess)
        crit = make_criteria(db, session=sess)

        review = Review(
            project_id=proj.id,
            reviewer_id=reviewer.id,
            comments="Great project",
            total_score=85.0,
            is_completed=True,
        )
        db.add(review)
        db.commit()
        db.refresh(review)

        score = CriteriaScore(
            review_id=review.id, criteria_id=crit.id, score=85.0
        )
        db.add(score)
        db.commit()

        assert review.id is not None
        assert len(review.criteria_scores) == 1


class TestEnums:
    def test_user_roles(self):
        assert set(UserRole) == {
            UserRole.STUDENT,
            UserRole.INTERNAL_REVIEWER,
            UserRole.EXTERNAL_REVIEWER,
            UserRole.ADMIN,
        }

    def test_project_statuses(self):
        assert set(ProjectStatus) == {
            ProjectStatus.PENDING,
            ProjectStatus.APPROVED,
            ProjectStatus.REJECTED,
        }

    def test_session_statuses(self):
        assert set(SessionStatus) == {
            SessionStatus.UPCOMING,
            SessionStatus.ACTIVE,
            SessionStatus.COMPLETED,
        }

    def test_notification_types(self):
        assert NotificationType.GENERAL.value == "general"
