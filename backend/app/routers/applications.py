from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import (
    ReviewerApplication, Session as SessionModel, User, UserRole, ApplicationStatus, NotificationType
)
from app.schemas import (
    ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse, NotificationCreate
)
from app.auth import get_current_user, require_reviewer, require_admin
from app.routers.notifications import create_notification

router = APIRouter(prefix="/applications", tags=["Reviewer Applications"])


@router.get("", response_model=List[ApplicationResponse])
async def list_applications(
    session_id: int = None,
    status: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List applications based on user role"""
    query = db.query(ReviewerApplication)
    
    # Reviewers only see their own applications
    if current_user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        query = query.filter(ReviewerApplication.reviewer_id == current_user.id)
    elif current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if session_id:
        query = query.filter(ReviewerApplication.session_id == session_id)
    if status:
        query = query.filter(ReviewerApplication.status == status)
    
    return query.order_by(ReviewerApplication.created_at.desc()).all()


@router.get("/my", response_model=List[ApplicationResponse])
async def get_my_applications(
    current_user: User = Depends(require_reviewer),
    db: Session = Depends(get_db)
):
    """Get current reviewer's applications"""
    return db.query(ReviewerApplication).filter(
        ReviewerApplication.reviewer_id == current_user.id
    ).order_by(ReviewerApplication.created_at.desc()).all()


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get application by ID"""
    application = db.query(ReviewerApplication).filter(
        ReviewerApplication.id == application_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Check permissions
    if current_user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        if application.reviewer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    elif current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return application


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    application_data: ApplicationCreate,
    current_user: User = Depends(require_reviewer),
    db: Session = Depends(get_db)
):
    """Apply to a session (reviewers only)"""
    # Check session exists and is available
    session = db.query(SessionModel).filter(SessionModel.id == application_data.session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Check for existing application
    existing = db.query(ReviewerApplication).filter(
        ReviewerApplication.session_id == application_data.session_id,
        ReviewerApplication.reviewer_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already applied to this session"
        )
    
    # Check if already assigned
    if current_user in session.reviewers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already assigned to this session"
        )
    
    application = ReviewerApplication(
        reviewer_id=current_user.id,
        session_id=application_data.session_id,
        message=application_data.message
    )
    
    db.add(application)
    db.commit()
    db.refresh(application)
    
    # Notify all admins about the new application
    admins = db.query(User).filter(User.role == UserRole.ADMIN.value).all()
    for admin in admins:
        notification = NotificationCreate(
            user_id=admin.id,
            type=NotificationType.GENERAL.value,
            title="New Session Application",
            message=f"{current_user.full_name} has applied to review session: {session.name}",
            link="/admin/applications"
        )
        create_notification(notification, db)
    
    return application


@router.put("/{application_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    application_id: int,
    status_update: ApplicationStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update application status (admin only)"""
    application = db.query(ReviewerApplication).filter(
        ReviewerApplication.id == application_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    application.status = status_update.status.value
    
    # If approved, add reviewer to session
    if status_update.status == ApplicationStatus.APPROVED:
        session = db.query(SessionModel).filter(SessionModel.id == application.session_id).first()
        reviewer = db.query(User).filter(User.id == application.reviewer_id).first()
        if reviewer not in session.reviewers:
            session.reviewers.append(reviewer)
        
        # Send approval notification
        notification = NotificationCreate(
            user_id=application.reviewer_id,
            type=NotificationType.APPLICATION_APPROVED,
            title="Application Approved",
            message=f'Your application to "{session.name}" has been approved!',
            link=f"/sessions/{session.id}"
        )
        create_notification(db, notification)
    elif status_update.status == ApplicationStatus.REJECTED:
        # Send rejection notification
        session = db.query(SessionModel).filter(SessionModel.id == application.session_id).first()
        notification = NotificationCreate(
            user_id=application.reviewer_id,
            type=NotificationType.APPLICATION_REJECTED,
            title="Application Update",
            message=f'Your application to "{session.name}" was not approved.',
            link=f"/applications"
        )
        create_notification(db, notification)
    
    db.commit()
    db.refresh(application)
    
    return application


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete/withdraw application"""
    application = db.query(ReviewerApplication).filter(
        ReviewerApplication.id == application_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Check permissions
    if current_user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        if application.reviewer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        if application.status != ApplicationStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot withdraw processed application"
            )
    elif current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    db.delete(application)
    db.commit()
    
    return None
