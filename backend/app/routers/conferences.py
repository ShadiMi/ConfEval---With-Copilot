from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from app.database import get_db
from app.models import Conference, Session as SessionModel, User, UserRole, ConferenceStatus
from app.schemas import (
    ConferenceCreate, ConferenceUpdate, ConferenceResponse, ConferenceWithSessions
)
from app.auth import get_current_user, require_admin

router = APIRouter(prefix="/conferences", tags=["Conferences"])


@router.get("/public", response_model=List[ConferenceResponse])
async def list_public_conferences(
    db: Session = Depends(get_db)
):
    """List active conferences - public endpoint (no auth required)"""
    return db.query(Conference).filter(
        Conference.status == ConferenceStatus.ACTIVE.value
    ).order_by(Conference.start_date.desc()).all()


@router.get("", response_model=List[ConferenceResponse])
async def list_conferences(
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all conferences"""
    query = db.query(Conference)
    
    # Non-admin users can only see active conferences
    if current_user.role != UserRole.ADMIN.value:
        query = query.filter(Conference.status == ConferenceStatus.ACTIVE.value)
    
    if status:
        query = query.filter(Conference.status == status)
    
    return query.order_by(Conference.start_date.desc()).offset(skip).limit(limit).all()


@router.get("/{conference_id}", response_model=ConferenceWithSessions)
async def get_conference(
    conference_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get conference details with sessions"""
    conference = db.query(Conference).filter(Conference.id == conference_id).first()
    
    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")
    
    # Non-admin users can only see active conferences
    if current_user.role != UserRole.ADMIN.value and conference.status != ConferenceStatus.ACTIVE.value:
        raise HTTPException(status_code=404, detail="Conference not found")
    
    # Add session count
    conference.session_count = len(conference.sessions)
    
    return conference


@router.post("", response_model=ConferenceResponse, status_code=status.HTTP_201_CREATED)
async def create_conference(
    conference_data: ConferenceCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new conference (admin only)"""
    # Validate dates
    if conference_data.end_date <= conference_data.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date must be after start date"
        )
    
    conference = Conference(
        name=conference_data.name,
        description=conference_data.description,
        start_date=conference_data.start_date,
        end_date=conference_data.end_date,
        location=conference_data.location,
        max_sessions=conference_data.max_sessions,
        status=ConferenceStatus.DRAFT.value
    )
    
    db.add(conference)
    db.commit()
    db.refresh(conference)
    
    return conference


@router.put("/{conference_id}", response_model=ConferenceResponse)
async def update_conference(
    conference_id: int,
    conference_data: ConferenceUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a conference (admin only)"""
    conference = db.query(Conference).filter(Conference.id == conference_id).first()
    
    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")
    
    update_data = conference_data.model_dump(exclude_unset=True)
    
    # Validate dates if both are provided
    start = update_data.get('start_date', conference.start_date)
    end = update_data.get('end_date', conference.end_date)
    if end <= start:
        raise HTTPException(
            status_code=400,
            detail="End date must be after start date"
        )
    
    # Check max_sessions against current session count
    if 'max_sessions' in update_data:
        current_session_count = len(conference.sessions)
        if update_data['max_sessions'] < current_session_count:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot set max_sessions to {update_data['max_sessions']}. Conference already has {current_session_count} sessions."
            )
    
    for key, value in update_data.items():
        if key == 'status' and value:
            setattr(conference, key, value.value if hasattr(value, 'value') else value)
        else:
            setattr(conference, key, value)
    
    db.commit()
    db.refresh(conference)
    
    return conference


@router.delete("/{conference_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conference(
    conference_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a conference (admin only)"""
    conference = db.query(Conference).filter(Conference.id == conference_id).first()
    
    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")
    
    # Check if conference has sessions
    if conference.sessions:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete conference with existing sessions. Remove sessions first or reassign them."
        )
    
    db.delete(conference)
    db.commit()
    
    return None


@router.get("/{conference_id}/sessions", response_model=List["SessionResponse"])
async def get_conference_sessions(
    conference_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all sessions for a conference"""
    from app.schemas import SessionResponse
    
    conference = db.query(Conference).filter(Conference.id == conference_id).first()
    
    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")
    
    return conference.sessions


@router.post("/{conference_id}/sessions/{session_id}")
async def add_session_to_conference(
    conference_id: int,
    session_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add an existing session to a conference (admin only)"""
    conference = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")
    
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check max sessions limit
    if len(conference.sessions) >= conference.max_sessions:
        raise HTTPException(
            status_code=400,
            detail=f"Conference has reached maximum number of sessions ({conference.max_sessions})"
        )
    
    session.conference_id = conference_id
    db.commit()
    
    return {"message": "Session added to conference successfully"}


@router.delete("/{conference_id}/sessions/{session_id}")
async def remove_session_from_conference(
    conference_id: int,
    session_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove a session from a conference (admin only)"""
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.conference_id == conference_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found in this conference")
    
    session.conference_id = None
    db.commit()
    
    return {"message": "Session removed from conference successfully"}
