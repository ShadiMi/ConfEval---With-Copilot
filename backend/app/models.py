from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, 
    ForeignKey, Float, Enum, Table
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    STUDENT = "student"
    INTERNAL_REVIEWER = "internal_reviewer"
    EXTERNAL_REVIEWER = "external_reviewer"
    ADMIN = "admin"


class ProjectStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SessionStatus(str, enum.Enum):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"


class ConferenceStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ApplicationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class NotificationType(str, enum.Enum):
    PROJECT_APPROVED = "project_approved"
    PROJECT_REJECTED = "project_rejected"
    REVIEW_SUBMITTED = "review_submitted"
    APPLICATION_APPROVED = "application_approved"
    APPLICATION_REJECTED = "application_rejected"
    SESSION_ASSIGNED = "session_assigned"
    GENERAL = "general"


class TeamInvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


# Association tables
project_tags = Table(
    'project_tags',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id', ondelete='CASCADE')),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete='CASCADE'))
)

reviewer_tags = Table(
    'reviewer_tags',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE')),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete='CASCADE'))
)

session_reviewers = Table(
    'session_reviewers',
    Base.metadata,
    Column('session_id', Integer, ForeignKey('sessions.id', ondelete='CASCADE')),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'))
)

session_tags = Table(
    'session_tags',
    Base.metadata,
    Column('session_id', Integer, ForeignKey('sessions.id', ondelete='CASCADE')),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete='CASCADE'))
)

project_reviewers = Table(
    'project_reviewers',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id', ondelete='CASCADE')),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'))
)

# Team members for projects (additional students beyond the owner)
project_team_members = Table(
    'project_team_members',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id', ondelete='CASCADE')),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'))
)


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Nullable for Google OAuth users
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.STUDENT)
    id_number = Column(String(9), nullable=True)  # 9-digit ID card number
    phone_number = Column(String(20), nullable=True)  # Optional phone number
    affiliation = Column(String(255), nullable=True)  # For external reviewers
    google_id = Column(String(255), unique=True, nullable=True)  # For Google OAuth
    cv_path = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=True)  # Reviewers need admin approval
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    projects = relationship("Project", back_populates="student", cascade="all, delete-orphan")
    team_projects = relationship("Project", secondary=project_team_members, back_populates="team_members")
    reviews = relationship("Review", back_populates="reviewer", cascade="all, delete-orphan")
    applications = relationship("ReviewerApplication", back_populates="reviewer", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    interested_tags = relationship("Tag", secondary=reviewer_tags, back_populates="interested_reviewers")
    assigned_sessions = relationship("Session", secondary=session_reviewers, back_populates="reviewers")
    assigned_projects = relationship("Project", secondary=project_reviewers, back_populates="assigned_reviewers")


class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    projects = relationship("Project", secondary=project_tags, back_populates="tags")
    interested_reviewers = relationship("User", secondary=reviewer_tags, back_populates="interested_tags")
    sessions = relationship("Session", secondary=session_tags, back_populates="tags")


class Conference(Base):
    __tablename__ = "conferences"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    building = Column(String(50), nullable=True)      # ספרא, לגסי, ...
    floor = Column(Integer, nullable=True)            # 1 or 2
    room_number = Column(Integer, nullable=True)      # 101..109

    location = Column(String(255), nullable=True)
    status = Column(String(50), default=ConferenceStatus.DRAFT)
    max_sessions = Column(Integer, default=10)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    sessions = relationship("Session", back_populates="conference", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    conference_id = Column(Integer, ForeignKey("conferences.id", ondelete="SET NULL"), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255), nullable=True)
    status = Column(String(50), default=SessionStatus.UPCOMING)
    max_projects = Column(Integer, default=50)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    conference = relationship("Conference", back_populates="sessions")
    projects = relationship("Project", back_populates="session", cascade="all, delete-orphan")
    criteria = relationship("Criteria", back_populates="session", cascade="all, delete-orphan")
    reviewers = relationship("User", secondary=session_reviewers, back_populates="assigned_sessions")
    applications = relationship("ReviewerApplication", back_populates="session", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=session_tags, back_populates="sessions")


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=True)
    status = Column(String(50), default=ProjectStatus.PENDING)
    mentor_email = Column(String(255), nullable=True)
    paper_path = Column(String(500), nullable=True)
    slides_path = Column(String(500), nullable=True)
    additional_docs_path = Column(String(500), nullable=True)
    poster_number = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    student = relationship("User", back_populates="projects")
    team_members = relationship("User", secondary=project_team_members, back_populates="team_projects")
    pending_invitations = relationship("ProjectTeamInvitation", back_populates="project", cascade="all, delete-orphan")
    session = relationship("Session", back_populates="projects")
    tags = relationship("Tag", secondary=project_tags, back_populates="projects")
    reviews = relationship("Review", back_populates="project", cascade="all, delete-orphan")
    assigned_reviewers = relationship("User", secondary=project_reviewers, back_populates="assigned_projects")


class Criteria(Base):
    __tablename__ = "criteria"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    max_score = Column(Integer, default=100)
    weight = Column(Float, default=1.0)
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    session = relationship("Session", back_populates="criteria")
    scores = relationship("CriteriaScore", back_populates="criteria", cascade="all, delete-orphan")


class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comments = Column(Text, nullable=True)
    total_score = Column(Float, nullable=True)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")
    criteria_scores = relationship("CriteriaScore", back_populates="review", cascade="all, delete-orphan")


class CriteriaScore(Base):
    __tablename__ = "criteria_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False)
    criteria_id = Column(Integer, ForeignKey("criteria.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, nullable=False)
    
    # Relationships
    review = relationship("Review", back_populates="criteria_scores")
    criteria = relationship("Criteria", back_populates="scores")


class ReviewerApplication(Base):
    __tablename__ = "reviewer_applications"
    
    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default=ApplicationStatus.PENDING)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    reviewer = relationship("User", back_populates="applications")
    session = relationship("Session", back_populates="applications")


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)  # Optional link to related resource
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="notifications")


class SiteSettings(Base):
    """Store site-wide settings like internal reviewer default affiliation"""
    __tablename__ = "site_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ProjectTeamInvitation(Base):
    """Pending team invitations for unregistered users"""
    __tablename__ = "project_team_invitations"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    status = Column(String(50), default=TeamInvitationStatus.PENDING)
    invited_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="pending_invitations")
    invited_by = relationship("User")
