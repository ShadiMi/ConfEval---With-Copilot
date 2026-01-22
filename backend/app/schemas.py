from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from app.models import UserRole, ProjectStatus, SessionStatus, ApplicationStatus, NotificationType, TeamInvitationStatus


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    role: UserRole = UserRole.STUDENT
    id_number: Optional[str] = Field(None, min_length=9, max_length=9, pattern=r'^\d{9}$')
    phone_number: Optional[str] = None
    affiliation: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)
    
    @validator('password')
    def validate_password(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    id_number: Optional[str] = Field(None, min_length=9, max_length=9, pattern=r'^\d{9}$')
    phone_number: Optional[str] = None
    affiliation: Optional[str] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_approved: bool
    cv_path: Optional[str] = None
    google_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserWithTags(UserResponse):
    interested_tags: List["TagResponse"] = []
    
    class Config:
        from_attributes = True


# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Tag Schemas
class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class TagCreate(TagBase):
    pass


class TagResponse(TagBase):
    id: int
    
    class Config:
        from_attributes = True


# Session Schemas
class SessionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    location: Optional[str] = None
    max_projects: int = 50


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    status: Optional[SessionStatus] = None
    max_projects: Optional[int] = None


class SessionResponse(SessionBase):
    id: int
    status: SessionStatus
    created_at: datetime
    
    class Config:
        from_attributes = True


class SessionWithDetails(SessionResponse):
    criteria: List["CriteriaResponse"] = []
    reviewers: List[UserResponse] = []
    tags: List["TagResponse"] = []
    project_count: int = 0
    
    class Config:
        from_attributes = True


# Project Schemas
class ProjectBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    session_id: Optional[int] = None
    tag_ids: List[int] = []
    team_member_emails: List[EmailStr] = []  # Up to 2 additional team members
    mentor_email: Optional[EmailStr] = None
    
    @validator('team_member_emails')
    def validate_team_members(cls, v):
        if len(v) > 2:
            raise ValueError('Maximum 2 additional team members allowed')
        # Remove duplicates while preserving order
        seen = set()
        unique = []
        for email in v:
            if email.lower() not in seen:
                seen.add(email.lower())
                unique.append(email)
        return unique


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    session_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None
    mentor_email: Optional[EmailStr] = None


class ProjectStatusUpdate(BaseModel):
    status: ProjectStatus
    poster_number: Optional[str] = None


# Team Invitation Schema
class TeamInvitationResponse(BaseModel):
    id: int
    email: str
    status: TeamInvitationStatus
    created_at: datetime
    
    class Config:
        from_attributes = True


class ProjectResponse(ProjectBase):
    id: int
    student_id: int
    session_id: Optional[int] = None
    status: ProjectStatus
    mentor_email: Optional[str] = None
    paper_path: Optional[str] = None
    slides_path: Optional[str] = None
    additional_docs_path: Optional[str] = None
    poster_number: Optional[str] = None
    created_at: datetime
    tags: List[TagResponse] = []
    team_members: List[UserResponse] = []
    pending_invitations: List[TeamInvitationResponse] = []
    avg_score: Optional[float] = None
    review_count: int = 0
    
    class Config:
        from_attributes = True


class ProjectWithStudent(ProjectResponse):
    student: UserResponse
    assigned_reviewers: List[UserResponse] = []
    session: Optional[SessionResponse] = None
    
    class Config:
        from_attributes = True


# Criteria Schemas
class CriteriaBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    max_score: int = Field(100, ge=1, le=100)
    weight: float = Field(1.0, ge=0.1, le=10.0)
    order: int = 0


class CriteriaCreate(CriteriaBase):
    session_id: int


class CriteriaUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    max_score: Optional[int] = Field(None, ge=1, le=100)
    weight: Optional[float] = Field(None, ge=0.1, le=10.0)
    order: Optional[int] = None


class CriteriaResponse(CriteriaBase):
    id: int
    session_id: int
    
    class Config:
        from_attributes = True


# Review Schemas
class CriteriaScoreCreate(BaseModel):
    criteria_id: int
    score: float = Field(..., ge=0)


class ReviewCreate(BaseModel):
    project_id: int
    comments: Optional[str] = None
    criteria_scores: List[CriteriaScoreCreate] = []


class ReviewUpdate(BaseModel):
    comments: Optional[str] = None
    criteria_scores: Optional[List[CriteriaScoreCreate]] = None
    is_completed: Optional[bool] = None


class CriteriaScoreResponse(BaseModel):
    id: int
    criteria_id: int
    score: float
    criteria: CriteriaResponse
    
    class Config:
        from_attributes = True


class ReviewResponse(BaseModel):
    id: int
    project_id: int
    reviewer_id: int
    comments: Optional[str] = None
    total_score: Optional[float] = None
    is_completed: bool
    created_at: datetime
    criteria_scores: List[CriteriaScoreResponse] = []
    reviewer: UserResponse
    
    class Config:
        from_attributes = True


# Application Schemas
class ApplicationCreate(BaseModel):
    session_id: int
    message: Optional[str] = None


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus


class ApplicationResponse(BaseModel):
    id: int
    reviewer_id: int
    session_id: int
    status: ApplicationStatus
    message: Optional[str] = None
    created_at: datetime
    reviewer: UserResponse
    session: SessionResponse
    
    class Config:
        from_attributes = True


# Notification Schemas
class NotificationCreate(BaseModel):
    user_id: int
    type: NotificationType
    title: str = Field(..., max_length=255)
    message: str
    link: Optional[str] = None


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Update forward references
UserWithTags.model_rebuild()
SessionWithDetails.model_rebuild()
