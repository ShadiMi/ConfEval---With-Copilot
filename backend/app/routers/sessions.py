from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List
from datetime import datetime, timezone

from app.database import get_db
from app.models import Session as SessionModel, User, UserRole, SessionStatus, Tag, Conference
from app.schemas import (
    SessionCreate, SessionUpdate, SessionResponse, SessionWithDetails
)
from app.auth import get_current_user, require_admin

router = APIRouter(prefix="/sessions", tags=["Sessions"])


# ---------------------------
# Date validation helpers
# ---------------------------
def _to_aware(dt: datetime) -> datetime:
    """Normalize datetime to timezone-aware UTC."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _validate_session_dates(
    start_date: datetime,
    end_date: datetime,
    conference_id: int | None,
    db: Session,
    exclude_session_id: int | None = None,
    is_new: bool = True,
):
    """
    Validate session dates:
      1. start_date must not be in the past (only enforced for new/changed sessions).
      2. end_date must be after start_date.
      3. If conference_id given, session must be within conference dates.
      4. Sessions in the same conference must not overlap.
    """
    start = _to_aware(start_date)
    end = _to_aware(end_date)
    now = datetime.now(timezone.utc)

    if end <= start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date",
        )

    if is_new and start < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session start date cannot be in the past",
        )

    if conference_id is not None:
        conference = db.query(Conference).filter(Conference.id == conference_id).first()
        if not conference:
            raise HTTPException(status_code=404, detail="Conference not found")

        conf_start = _to_aware(conference.start_date)
        conf_end = _to_aware(conference.end_date)

        if start < conf_start or end > conf_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session must be within the conference start and end dates",
            )

        # Overlap check against sibling sessions
        siblings_q = db.query(SessionModel).filter(SessionModel.conference_id == conference_id)
        if exclude_session_id is not None:
            siblings_q = siblings_q.filter(SessionModel.id != exclude_session_id)

        for sibling in siblings_q.all():
            sib_start = _to_aware(sibling.start_date)
            sib_end = _to_aware(sibling.end_date)
            # Overlap when neither ends before the other starts
            if not (end <= sib_start or start >= sib_end):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Session overlaps with existing session '{sibling.name}' "
                        f"in the same conference"
                    ),
                )


@router.get("/public", response_model=List[SessionResponse])
async def list_public_sessions(
    db: Session = Depends(get_db)
):
    """List active and upcoming sessions - public endpoint (no auth required)"""
    return db.query(SessionModel).filter(
        SessionModel.status.in_([SessionStatus.ACTIVE.value, SessionStatus.UPCOMING.value])
    ).order_by(SessionModel.start_date.asc()).all()


@router.get("/", response_model=list[SessionResponse])
def list_all_sessions(db: Session = Depends(get_db)):
    sessions = (
        db.query(SessionModel)
        .options(selectinload(SessionModel.conference))
        .all()
    )
    return sessions


@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all sessions"""
    query = db.query(SessionModel)
    
    # Non-admin users can only see active and upcoming sessions
    if current_user.role != UserRole.ADMIN.value:
        query = query.filter(SessionModel.status.in_([SessionStatus.ACTIVE.value, SessionStatus.UPCOMING.value]))
    
    if status:
        query = query.filter(SessionModel.status == status)
    
    return query.order_by(SessionModel.start_date.desc()).offset(skip).limit(limit).all()


@router.get("/available", response_model=List[SessionResponse])
async def list_available_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List available sessions for reviewer applications"""
    return db.query(SessionModel).filter(
        SessionModel.status.in_([SessionStatus.ACTIVE.value, SessionStatus.UPCOMING.value]),
        SessionModel.start_date > datetime.utcnow()
    ).order_by(SessionModel.start_date.asc()).all()


@router.get("/{session_id}", response_model=SessionWithDetails)
async def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get session by ID with details"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Add project count
    response = SessionWithDetails.model_validate(session)
    response.project_count = len(session.projects)
    
    return response


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new session (admin only)"""
    _validate_session_dates(
        session_data.start_date,
        session_data.end_date,
        session_data.conference_id,
        db,
        exclude_session_id=None,
        is_new=True,
    )

    # Determine initial status - make datetimes comparable
    now = datetime.now(timezone.utc)
    start_date = _to_aware(session_data.start_date)
    end_date = _to_aware(session_data.end_date)
    
    if start_date > now:
        session_status = SessionStatus.UPCOMING.value
    elif end_date < now:
        session_status = SessionStatus.COMPLETED.value
    else:
        session_status = SessionStatus.ACTIVE.value
    
    session = SessionModel(
        **session_data.model_dump(),
        status=session_status
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return session


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    session_update: SessionUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update session (admin only)"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    update_data = session_update.model_dump(exclude_unset=True)
    
    # Validate dates if updating
    start_date = update_data.get('start_date', session.start_date)
    end_date = update_data.get('end_date', session.end_date)
    conference_id = update_data.get('conference_id', session.conference_id)
    # Only enforce "not in the past" if dates are being changed
    dates_changed = ('start_date' in update_data) or ('end_date' in update_data)
    _validate_session_dates(
        start_date,
        end_date,
        conference_id,
        db,
        exclude_session_id=session.id,
        is_new=dates_changed,
    )
    
    for key, value in update_data.items():
        if value is not None:
            if hasattr(value, 'value'):  # Handle enum
                setattr(session, key, value.value)
            else:
                setattr(session, key, value)
    
    db.commit()
    db.refresh(session)
    
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete session (admin only)"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    db.delete(session)
    db.commit()
    
    return None


@router.post("/{session_id}/reviewers/{user_id}")
async def add_reviewer_to_session(
    session_id: int,
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add reviewer to session (admin only)"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.role not in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a reviewer"
        )
    
    if user in session.reviewers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviewer already assigned to session"
        )
    
    session.reviewers.append(user)
    db.commit()
    
    return {"message": "Reviewer added to session"}


@router.delete("/{session_id}/reviewers/{user_id}")
async def remove_reviewer_from_session(
    session_id: int,
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove reviewer from session (admin only)"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user not in session.reviewers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reviewer not found in session"
        )
    
    session.reviewers.remove(user)
    db.commit()
    
    return {"message": "Reviewer removed from session"}


@router.post("/{session_id}/tags/{tag_id}")
async def add_tag_to_session(
    session_id: int,
    tag_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add tag to session (admin only)"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    if tag in session.tags:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag already assigned to session"
        )
    
    session.tags.append(tag)
    db.commit()
    
    return {"message": "Tag added to session"}


@router.delete("/{session_id}/tags/{tag_id}")
async def remove_tag_from_session(
    session_id: int,
    tag_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove tag from session (admin only)"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag or tag not in session.tags:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found in session"
        )
    
    session.tags.remove(tag)
    db.commit()
    
    return {"message": "Tag removed from session"}
