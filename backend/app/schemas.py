from pydantic import field_validator, ConfigDict, BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from app.models import UserRole, ProjectStatus, SessionStatus, ApplicationStatus, NotificationType, TeamInvitationStatus, ConferenceStatus


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
    
    @field_validator('password')
    @classmethod
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
    model_config = ConfigDict(from_attributes=True)


class UserWithTags(UserResponse):
    interested_tags: List["TagResponse"] = []
    model_config = ConfigDict(from_attributes=True)


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
    model_config = ConfigDict(from_attributes=True)


# Session Schemas
class SessionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    location: Optional[str] = None
    max_projects: int = 50


class SessionCreate(SessionBase):
    conference_id: Optional[int] = None


class SessionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    status: Optional[SessionStatus] = None
    max_projects: Optional[int] = None
    conference_id: Optional[int] = None


class SessionResponse(SessionBase):
    id: int
    status: SessionStatus
    conference_id: Optional[int] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SessionWithDetails(SessionResponse):
    criteria: List["CriteriaResponse"] = []
    reviewers: List[UserResponse] = []
    tags: List["TagResponse"] = []
    project_count: int = 0
    model_config = ConfigDict(from_attributes=True)


# Project Schemas
class ProjectBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    session_id: Optional[int] = None
    tag_ids: List[int] = []
    team_member_emails: List[EmailStr] = []  # Up to 2 additional team members
    mentor_email: Optional[EmailStr] = None
    
    @field_validator('team_member_emails')
    @classmethod
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
    model_config = ConfigDict(from_attributes=True)


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
    model_config = ConfigDict(from_attributes=True)


class ProjectWithStudent(ProjectResponse):
    student: UserResponse
    assigned_reviewers: List[UserResponse] = []
    session: Optional[SessionResponse] = None
    model_config = ConfigDict(from_attributes=True)


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
    model_config = ConfigDict(from_attributes=True)


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
    model_config = ConfigDict(from_attributes=True)


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
    model_config = ConfigDict(from_attributes=True)


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
    model_config = ConfigDict(from_attributes=True)


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
    model_config = ConfigDict(from_attributes=True)

ALLOWED_BUILDINGS = {"לגסי", "אינשטיין", "ספרא", "מינקוף", "קציר", "שמעון"}


def allowed_rooms_for_floor(floor: int):
    if floor == 1:
        return list(range(101, 110))  # 101..109
    if floor == 2:
        return list(range(201, 210))  # 201..209
    return []

# Conference Schemas
class ConferenceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime

    building: Optional[str] = None
    floor: Optional[int] = None
    room_number: Optional[int] = None

    location: Optional[str] = None
    max_sessions: int = Field(default=10, ge=1, le=100)

    @field_validator("building")
    @classmethod
    def validate_building(cls, v):
        if v is None:
            return v
        if v not in ALLOWED_BUILDINGS:
            raise ValueError(f"Invalid building. Allowed: {sorted(ALLOWED_BUILDINGS)}")
        return v

    @field_validator("floor")
    @classmethod
    def validate_floor(cls, v):
        if v is None:
            return v
        if v not in (1, 2):
            raise ValueError("floor must be 1 or 2")
        return v

    # TODO[pydantic]: We couldn't refactor the `validator`, please replace it by `field_validator` manually.
    # Check https://docs.pydantic.dev/dev-v2/migration/#changes-to-validators for more information.
    @validator("room_number")
    def validate_room_number(cls, room, values):
        floor = values.get("floor")
        if room is None or floor is None:
            return room

        allowed = allowed_rooms_for_floor(int(floor))
        if room not in allowed:
            raise ValueError(f"For floor {floor}, room_number must be one of: {allowed}")
        return room




class ConferenceCreate(ConferenceBase):
    pass

class ConferenceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    

    location: Optional[str] = None
    status: Optional[ConferenceStatus] = None
    max_sessions: Optional[int] = Field(None, ge=1, le=100)
    building: Optional[str] = None
    floor: Optional[int] = None
    room_number: Optional[int] = None

    @field_validator("building")
    @classmethod
    def validate_building(cls, v):
        if v is None:
            return v
        if v not in ALLOWED_BUILDINGS:
            raise ValueError(f"Invalid building. Allowed: {sorted(ALLOWED_BUILDINGS)}")
        return v

    @field_validator("floor")
    @classmethod
    def validate_floor(cls, v):
        if v is None:
            return v
        if v not in (1, 2):
            raise ValueError("floor must be 1 or 2")
        return v

    # TODO[pydantic]: We couldn't refactor the `validator`, please replace it by `field_validator` manually.
    # Check https://docs.pydantic.dev/dev-v2/migration/#changes-to-validators for more information.
    @validator("room_number")
    def validate_room_number(cls, room, values):
        floor = values.get("floor")
        if room is None or floor is None:
            return room

        allowed = allowed_rooms_for_floor(int(floor))
        if room not in allowed:
            raise ValueError(f"For floor {floor}, room_number must be one of: {allowed}")
        return room


class ConferenceResponse(ConferenceBase):
    id: int
    status: ConferenceStatus
    # created_at: datetime
    name: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    location: Optional[str] = None
    status: str
    max_sessions: int

    # ✅ add these so edit modal can load them
    building: Optional[str] = None
    floor: Optional[int] = None
    room_number: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


class ConferenceWithSessions(ConferenceResponse):
    sessions: List[SessionResponse] = []
    session_count: int = 0
    model_config = ConfigDict(from_attributes=True)


# Update forward references
UserWithTags.model_rebuild()
SessionWithDetails.model_rebuild()
ConferenceWithSessions.model_rebuild()
