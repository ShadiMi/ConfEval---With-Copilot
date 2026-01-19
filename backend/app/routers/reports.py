from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import csv
import io
from datetime import datetime
from jose import JWTError, jwt

from app.database import get_db
from app.models import (
    Session as SessionModel, User, UserRole, Project, Review, 
    ProjectStatus, SessionStatus, Tag
)
from app.auth import require_admin
from app.config import settings

router = APIRouter(prefix="/reports", tags=["Reports"])


def get_user_from_token(token: str, db: Session) -> User:
    """Validate token and get user for download endpoints"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user


@router.get("/overview")
async def get_admin_overview(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get comprehensive admin overview statistics"""
    
    # User statistics
    total_users = db.query(User).count()
    students = db.query(User).filter(User.role == UserRole.STUDENT.value).count()
    internal_reviewers = db.query(User).filter(User.role == UserRole.INTERNAL_REVIEWER.value).count()
    external_reviewers = db.query(User).filter(User.role == UserRole.EXTERNAL_REVIEWER.value).count()
    admins = db.query(User).filter(User.role == UserRole.ADMIN.value).count()
    pending_approval = db.query(User).filter(
        User.role.in_([UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]),
        User.is_approved == False
    ).count()
    
    # Session statistics
    total_sessions = db.query(SessionModel).count()
    active_sessions = db.query(SessionModel).filter(SessionModel.status == SessionStatus.ACTIVE.value).count()
    upcoming_sessions = db.query(SessionModel).filter(SessionModel.status == SessionStatus.UPCOMING.value).count()
    completed_sessions = db.query(SessionModel).filter(SessionModel.status == SessionStatus.COMPLETED.value).count()
    
    # Project statistics
    total_projects = db.query(Project).count()
    pending_projects = db.query(Project).filter(Project.status == ProjectStatus.PENDING.value).count()
    approved_projects = db.query(Project).filter(Project.status == ProjectStatus.APPROVED.value).count()
    rejected_projects = db.query(Project).filter(Project.status == ProjectStatus.REJECTED.value).count()
    
    # Review statistics
    total_reviews = db.query(Review).count()
    completed_reviews = db.query(Review).filter(Review.is_completed == True).count()
    pending_reviews = db.query(Review).filter(Review.is_completed == False).count()
    
    # Calculate average score
    avg_score = db.query(func.avg(Review.total_score)).filter(
        Review.is_completed == True,
        Review.total_score.isnot(None)
    ).scalar() or 0
    
    return {
        "users": {
            "total": total_users,
            "students": students,
            "internal_reviewers": internal_reviewers,
            "external_reviewers": external_reviewers,
            "admins": admins,
            "pending_approval": pending_approval
        },
        "sessions": {
            "total": total_sessions,
            "active": active_sessions,
            "upcoming": upcoming_sessions,
            "completed": completed_sessions
        },
        "projects": {
            "total": total_projects,
            "pending": pending_projects,
            "approved": approved_projects,
            "rejected": rejected_projects
        },
        "reviews": {
            "total": total_reviews,
            "completed": completed_reviews,
            "pending": pending_reviews,
            "average_score": round(avg_score, 2)
        }
    }


@router.get("/sessions/{session_id}/details")
async def get_session_details(
    session_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get detailed report for a specific session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get projects in this session
    projects = db.query(Project).filter(Project.session_id == session_id).all()
    
    project_details = []
    for project in projects:
        reviews = db.query(Review).filter(Review.project_id == project.id).all()
        completed_reviews = [r for r in reviews if r.is_completed]
        avg_score = sum(r.total_score for r in completed_reviews if r.total_score) / len(completed_reviews) if completed_reviews else 0
        
        project_details.append({
            "id": project.id,
            "title": project.title,
            "student_name": project.student.full_name,
            "student_email": project.student.email,
            "status": project.status,
            "tags": [t.name for t in project.tags],
            "assigned_reviewers": [
                {"id": r.id, "name": r.full_name, "email": r.email}
                for r in project.assigned_reviewers
            ],
            "reviews": {
                "total": len(reviews),
                "completed": len(completed_reviews),
                "average_score": round(avg_score, 2)
            },
            "created_at": project.created_at.isoformat() if project.created_at else None
        })
    
    # Get reviewers assigned to projects in this session
    reviewers_in_session = set()
    for project in projects:
        for reviewer in project.assigned_reviewers:
            reviewers_in_session.add(reviewer.id)
    
    reviewer_stats = []
    for reviewer_id in reviewers_in_session:
        reviewer = db.query(User).filter(User.id == reviewer_id).first()
        if reviewer:
            session_projects = [p for p in reviewer.assigned_projects if p.session_id == session_id]
            session_reviews = db.query(Review).join(Project).filter(
                Review.reviewer_id == reviewer_id,
                Project.session_id == session_id
            ).all()
            completed = [r for r in session_reviews if r.is_completed]
            
            reviewer_stats.append({
                "id": reviewer.id,
                "name": reviewer.full_name,
                "email": reviewer.email,
                "role": reviewer.role,
                "assigned_projects": len(session_projects),
                "completed_reviews": len(completed),
                "pending_reviews": len(session_projects) - len(completed)
            })
    
    return {
        "session": {
            "id": session.id,
            "name": session.name,
            "description": session.description,
            "status": session.status,
            "start_date": session.start_date.isoformat() if session.start_date else None,
            "end_date": session.end_date.isoformat() if session.end_date else None,
            "location": session.location,
            "max_projects": session.max_projects,
            "tags": [t.name for t in session.tags]
        },
        "statistics": {
            "total_projects": len(projects),
            "approved_projects": len([p for p in projects if p.status == ProjectStatus.APPROVED.value]),
            "pending_projects": len([p for p in projects if p.status == ProjectStatus.PENDING.value]),
            "rejected_projects": len([p for p in projects if p.status == ProjectStatus.REJECTED.value]),
            "total_reviewers": len(reviewers_in_session),
            "total_reviews": sum(len([r for r in p.reviews]) for p in projects),
            "completed_reviews": sum(len([r for r in p.reviews if r.is_completed]) for p in projects)
        },
        "projects": project_details,
        "reviewers": reviewer_stats
    }


@router.get("/sessions/{session_id}/export")
async def export_session_report(
    session_id: int,
    token: str = Query(..., description="Authentication token"),
    db: Session = Depends(get_db)
):
    """Export session report as CSV"""
    # Validate admin token
    get_user_from_token(token, db)
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get projects with reviews
    projects = db.query(Project).filter(Project.session_id == session_id).all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'Project ID', 'Project Title', 'Student Name', 'Student Email',
        'Status', 'Tags', 'Assigned Reviewers', 'Completed Reviews',
        'Average Score', 'Created At'
    ])
    
    for project in projects:
        reviews = [r for r in project.reviews if r.is_completed]
        avg_score = sum(r.total_score for r in reviews if r.total_score) / len(reviews) if reviews else 0
        
        writer.writerow([
            project.id,
            project.title,
            project.student.full_name,
            project.student.email,
            project.status,
            ', '.join([t.name for t in project.tags]),
            ', '.join([r.full_name for r in project.assigned_reviewers]),
            len(reviews),
            round(avg_score, 2),
            project.created_at.strftime('%Y-%m-%d %H:%M') if project.created_at else ''
        ])
    
    output.seek(0)
    
    filename = f"session_{session_id}_{session.name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/all")
async def export_all_data(
    token: str = Query(..., description="Authentication token"),
    db: Session = Depends(get_db)
):
    """Export comprehensive report of all data"""
    # Validate admin token
    get_user_from_token(token, db)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Sessions overview
    writer.writerow(['=== SESSIONS ==='])
    writer.writerow(['ID', 'Name', 'Status', 'Start Date', 'End Date', 'Location', 'Projects Count'])
    sessions = db.query(SessionModel).all()
    for s in sessions:
        project_count = db.query(Project).filter(Project.session_id == s.id).count()
        writer.writerow([
            s.id, s.name, s.status,
            s.start_date.strftime('%Y-%m-%d') if s.start_date else '',
            s.end_date.strftime('%Y-%m-%d') if s.end_date else '',
            s.location or '',
            project_count
        ])
    
    writer.writerow([])
    writer.writerow(['=== PROJECTS ==='])
    writer.writerow([
        'ID', 'Title', 'Session', 'Student', 'Status', 'Tags',
        'Reviewers Assigned', 'Reviews Completed', 'Avg Score'
    ])
    projects = db.query(Project).all()
    for p in projects:
        reviews = [r for r in p.reviews if r.is_completed]
        avg_score = sum(r.total_score for r in reviews if r.total_score) / len(reviews) if reviews else 0
        writer.writerow([
            p.id, p.title,
            p.session.name if p.session else 'No session',
            p.student.full_name,
            p.status,
            ', '.join([t.name for t in p.tags]),
            len(p.assigned_reviewers),
            len(reviews),
            round(avg_score, 2)
        ])
    
    writer.writerow([])
    writer.writerow(['=== REVIEWERS ==='])
    writer.writerow(['ID', 'Name', 'Email', 'Role', 'Affiliation', 'Approved', 'Projects Assigned', 'Reviews Completed'])
    reviewers = db.query(User).filter(
        User.role.in_([UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value])
    ).all()
    for r in reviewers:
        completed_reviews = db.query(Review).filter(
            Review.reviewer_id == r.id,
            Review.is_completed == True
        ).count()
        writer.writerow([
            r.id, r.full_name, r.email, r.role,
            r.affiliation or '', 'Yes' if r.is_approved else 'No',
            len(r.assigned_projects), completed_reviews
        ])
    
    output.seek(0)
    
    filename = f"confeval_full_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
