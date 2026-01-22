from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
from jose import jwt, JWTError

from app.database import get_db
from app.models import Project, User, UserRole, Tag, ProjectStatus, Session as SessionModel, Notification, NotificationType, ProjectTeamInvitation, TeamInvitationStatus
from app.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectWithStudent, ProjectStatusUpdate, NotificationCreate
)
from app.auth import get_current_user, require_admin, require_student
from app.config import settings
from app.routers.notifications import create_notification

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("/pending-count")
async def get_pending_projects_count(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get count of pending projects (admin only)"""
    count = db.query(Project).filter(Project.status == ProjectStatus.PENDING.value).count()
    return {"pending_count": count}


@router.get("", response_model=List[ProjectWithStudent])
async def list_projects(
    session_id: int = None,
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List projects based on user role"""
    from sqlalchemy import or_
    query = db.query(Project)
    
    # Students see their own projects + projects they are team members of
    if current_user.role == UserRole.STUDENT.value:
        query = query.filter(
            or_(
                Project.student_id == current_user.id,
                Project.team_members.any(id=current_user.id)
            )
        )
    
    # Reviewers see approved projects in sessions they're assigned to OR projects assigned directly to them
    if current_user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        # Get session IDs the reviewer is assigned to
        assigned_session_ids = [s.id for s in current_user.assigned_sessions]
        
        query = query.filter(
            Project.status == ProjectStatus.APPROVED.value,
            or_(
                Project.assigned_reviewers.any(id=current_user.id),
                Project.session_id.in_(assigned_session_ids) if assigned_session_ids else False
            )
        )
    
    # Apply filters
    if session_id:
        query = query.filter(Project.session_id == session_id)
    if status:
        query = query.filter(Project.status == status)
    
    return query.order_by(Project.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/my", response_model=List[ProjectResponse])
async def get_my_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's projects (students) - owned or as team member"""
    if current_user.role != UserRole.STUDENT.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint"
        )
    from sqlalchemy import or_, func
    from app.models import Review
    
    projects = db.query(Project).filter(
        or_(
            Project.student_id == current_user.id,
            Project.team_members.any(id=current_user.id)
        )
    ).all()
    
    # Calculate avg_score and review_count for each project
    result = []
    for project in projects:
        reviews = db.query(Review).filter(
            Review.project_id == project.id,
            Review.is_completed == True
        ).all()
        
        # Calculate average only from reviews that have a total_score
        reviews_with_scores = [r for r in reviews if r.total_score is not None]
        avg_score = None
        if reviews_with_scores:
            avg_score = sum(r.total_score for r in reviews_with_scores) / len(reviews_with_scores)
        
        project_dict = {
            "id": project.id,
            "title": project.title,
            "description": project.description,
            "student_id": project.student_id,
            "session_id": project.session_id,
            "status": project.status,
            "mentor_email": project.mentor_email,
            "paper_path": project.paper_path,
            "slides_path": project.slides_path,
            "additional_docs_path": project.additional_docs_path,
            "poster_number": project.poster_number,
            "created_at": project.created_at,
            "tags": project.tags,
            "team_members": project.team_members,
            "pending_invitations": project.pending_invitations,
            "review_count": len(reviews_with_scores),
            "avg_score": avg_score
        }
        result.append(project_dict)
    
    return result


@router.get("/my/invitations")
async def get_my_pending_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pending team invitations for the current user"""
    if current_user.role != UserRole.STUDENT.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint"
        )
    
    invitations = db.query(ProjectTeamInvitation).filter(
        ProjectTeamInvitation.email == current_user.email.lower(),
        ProjectTeamInvitation.status == TeamInvitationStatus.PENDING
    ).all()
    
    result = []
    for inv in invitations:
        result.append({
            "id": inv.id,
            "project_id": inv.project_id,
            "project_title": inv.project.title,
            "invited_by": inv.invited_by.full_name,
            "created_at": inv.created_at
        })
    return result


@router.post("/invitations/{invitation_id}/accept")
async def accept_team_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a team invitation"""
    invitation = db.query(ProjectTeamInvitation).filter(
        ProjectTeamInvitation.id == invitation_id,
        ProjectTeamInvitation.email == current_user.email.lower(),
        ProjectTeamInvitation.status == TeamInvitationStatus.PENDING
    ).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or already responded"
        )
    
    # Add user to team members
    project = invitation.project
    if current_user not in project.team_members:
        project.team_members.append(current_user)
    
    # Update invitation status
    invitation.status = TeamInvitationStatus.ACCEPTED
    from sqlalchemy.sql import func
    invitation.responded_at = func.now()
    
    db.commit()
    
    return {"message": "Invitation accepted", "project_id": project.id}


@router.post("/invitations/{invitation_id}/decline")
async def decline_team_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Decline a team invitation"""
    invitation = db.query(ProjectTeamInvitation).filter(
        ProjectTeamInvitation.id == invitation_id,
        ProjectTeamInvitation.email == current_user.email.lower(),
        ProjectTeamInvitation.status == TeamInvitationStatus.PENDING
    ).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or already responded"
        )
    
    invitation.status = TeamInvitationStatus.DECLINED
    from sqlalchemy.sql import func
    invitation.responded_at = func.now()
    
    db.commit()
    
    return {"message": "Invitation declined"}


# Assignment management routes - MUST come before /{project_id} routes
@router.get("/assignments/reviewers")
async def get_all_reviewers_for_assignment(
    session_id: int = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all approved reviewers with their tags for assignment purposes"""
    reviewers = db.query(User).filter(
        User.role.in_([UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]),
        User.is_approved == True,
        User.is_active == True
    ).all()
    
    result = []
    for r in reviewers:
        # Count assignments for the specific session if provided
        if session_id:
            session_count = sum(1 for p in r.assigned_projects if p.session_id == session_id)
        else:
            session_count = len(r.assigned_projects)
        
        result.append({
            "id": r.id,
            "full_name": r.full_name,
            "email": r.email,
            "role": r.role,
            "tags": [{"id": t.id, "name": t.name} for t in r.interested_tags],
            "assigned_projects_count": session_count,
            "total_assigned_projects": len(r.assigned_projects)
        })
    
    return result


@router.get("/assignments/projects")
async def get_all_projects_for_assignment(
    session_id: int = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all approved projects with their tags and assigned reviewers"""
    query = db.query(Project).filter(Project.status == ProjectStatus.APPROVED.value)
    
    if session_id:
        query = query.filter(Project.session_id == session_id)
    
    projects = query.all()
    
    return [
        {
            "id": p.id,
            "title": p.title,
            "session_id": p.session_id,
            "session_name": p.session.name if p.session else None,
            "student_name": p.student.full_name,
            "tags": [{"id": t.id, "name": t.name} for t in p.tags],
            "assigned_reviewers": [
                {"id": r.id, "full_name": r.full_name, "email": r.email}
                for r in p.assigned_reviewers
            ],
            "reviews_count": len([r for r in p.reviews if r.is_completed])
        }
        for p in projects
    ]


@router.post("/assignments/auto-assign")
async def auto_assign_reviewers(
    session_id: int = Query(None, description="Session ID to limit assignment to"),
    reviewers_per_project: int = Query(2, description="Number of reviewers to assign per project"),
    preview: bool = Query(False, description="If true, return proposed assignments without applying"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Automatically assign reviewers to projects based on tag matching.
    Reviewers with matching tags are prioritized.
    If preview=true, returns proposed assignments without applying them.
    """
    # Get all approved projects
    project_query = db.query(Project).filter(Project.status == ProjectStatus.APPROVED.value)
    if session_id:
        project_query = project_query.filter(Project.session_id == session_id)
    projects = project_query.all()
    
    # Get all approved and active reviewers
    reviewers = db.query(User).filter(
        User.role.in_([UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]),
        User.is_approved == True,
        User.is_active == True
    ).all()
    
    if not reviewers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No approved reviewers available"
        )
    
    assignments_made = 0
    proposed_assignments = []  # For preview mode
    
    # Track assignments per reviewer per session during this auto-assign run
    # to respect the 4-project limit
    reviewer_session_counts = {}
    for reviewer in reviewers:
        # Count existing assignments in this session (or all if no session filter)
        if session_id:
            count = sum(1 for p in reviewer.assigned_projects if p.session_id == session_id)
        else:
            count = len(reviewer.assigned_projects)
        reviewer_session_counts[reviewer.id] = count
    
    # For preview mode, track simulated assignments
    simulated_assignments = {}  # project_id -> list of reviewer_ids
    
    for project in projects:
        # Get project tag IDs
        project_tag_ids = {tag.id for tag in project.tags}
        
        # Get currently assigned (real + simulated for preview)
        currently_assigned = set(r.id for r in project.assigned_reviewers)
        if preview and project.id in simulated_assignments:
            currently_assigned.update(simulated_assignments[project.id])
        
        # Calculate scores for each reviewer
        reviewer_scores = []
        for reviewer in reviewers:
            # Skip if already assigned
            if reviewer.id in currently_assigned:
                continue
            
            # Skip if reviewer has reached 4-project limit for this session
            current_session_id = project.session_id
            if current_session_id:
                session_count = reviewer_session_counts[reviewer.id]
                if session_count >= 4:
                    continue
            
            # Calculate tag match score
            reviewer_tag_ids = {tag.id for tag in reviewer.interested_tags}
            matching_tags = project_tag_ids & reviewer_tag_ids
            tag_score = len(matching_tags)
            
            # Penalize reviewers who already have many assignments in this session (load balancing)
            if session_id:
                load_penalty = reviewer_session_counts[reviewer.id] * 0.5
            else:
                load_penalty = len(reviewer.assigned_projects) * 0.5
            
            final_score = tag_score - load_penalty
            reviewer_scores.append((reviewer, final_score, tag_score))
        
        # Sort by score (highest first), then by tag match count
        reviewer_scores.sort(key=lambda x: (x[1], x[2]), reverse=True)
        
        # Assign top reviewers until we reach the target
        current_count = len(currently_assigned)
        needed = reviewers_per_project - current_count
        
        for reviewer, score, _ in reviewer_scores[:needed]:
            if preview:
                # Just record the proposed assignment
                proposed_assignments.append({
                    "project_id": project.id,
                    "reviewer_id": reviewer.id,
                    "reviewer_name": reviewer.full_name
                })
                if project.id not in simulated_assignments:
                    simulated_assignments[project.id] = []
                simulated_assignments[project.id].append(reviewer.id)
            else:
                project.assigned_reviewers.append(reviewer)
            reviewer_session_counts[reviewer.id] += 1
            assignments_made += 1
    
    if not preview:
        db.commit()
    
    if preview:
        return {
            "message": f"Preview: {assignments_made} assignments would be made.",
            "assignments_count": assignments_made,
            "proposed_assignments": proposed_assignments
        }
    
    return {
        "message": f"Auto-assignment completed. {assignments_made} assignments made.",
        "assignments_made": assignments_made
    }


@router.delete("/assignments/clear")
async def clear_all_assignments(
    session_id: int = Query(None, description="Session ID to limit clearing to"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Clear all reviewer assignments (optionally for a specific session)"""
    project_query = db.query(Project)
    if session_id:
        project_query = project_query.filter(Project.session_id == session_id)
    projects = project_query.all()
    
    cleared = 0
    for project in projects:
        cleared += len(project.assigned_reviewers)
        project.assigned_reviewers = []
    
    db.commit()
    
    return {"message": f"Cleared {cleared} assignments"}


@router.get("/{project_id}", response_model=ProjectWithStudent)
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get project by ID"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check access permissions
    if current_user.role == UserRole.STUDENT.value:
        is_owner = project.student_id == current_user.id
        is_team_member = any(m.id == current_user.id for m in project.team_members)
        if not is_owner and not is_team_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    elif current_user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        if project.status != ProjectStatus.APPROVED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Project not yet approved"
            )
    
    return project


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Create a new project (students only)"""
    # Get tags
    tags = []
    if project_data.tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(project_data.tag_ids)).all()
        if len(tags) != len(project_data.tag_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Some tag IDs are invalid"
            )
    
    # Find team members by email - registered users get added directly, others get pending invitations
    team_members = []
    pending_emails = []
    for email in project_data.team_member_emails:
        # Don't allow adding yourself as a team member
        if email.lower() == current_user.email.lower():
            continue
        member = db.query(User).filter(
            User.email == email.lower(),
            User.role == UserRole.STUDENT.value
        ).first()
        if member:
            team_members.append(member)
        else:
            # Email not registered - will create pending invitation
            pending_emails.append(email.lower())
    
    project = Project(
        title=project_data.title,
        description=project_data.description,
        student_id=current_user.id,
        session_id=project_data.session_id,
        mentor_email=project_data.mentor_email,
        tags=tags,
        team_members=team_members
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Create pending invitations for unregistered emails
    for email in pending_emails:
        invitation = ProjectTeamInvitation(
            project_id=project.id,
            email=email,
            status=TeamInvitationStatus.PENDING,
            invited_by_id=current_user.id
        )
        db.add(invitation)
    db.commit()
    db.refresh(project)
    
    # Notify team members about being added
    for member in team_members:
        notification = NotificationCreate(
            user_id=member.id,
            type=NotificationType.GENERAL,
            title="Added to Project Team",
            message=f'You have been added to the project "{project.title}" by {current_user.full_name}.',
            link=f"/projects"
        )
        create_notification(db, notification)
    
    # Notify all admins about new project submission
    admins = db.query(User).filter(User.role == UserRole.ADMIN.value).all()
    for admin in admins:
        notification = NotificationCreate(
            user_id=admin.id,
            type=NotificationType.GENERAL,
            title="New Project Submission",
            message=f'New project "{project.title}" submitted by {current_user.full_name}.',
            link=f"/admin/projects"
        )
        create_notification(db, notification)
    
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update project (student owner or admin)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check permissions
    if current_user.role == UserRole.STUDENT.value:
        if project.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        if project.status != ProjectStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update approved/rejected project"
            )
    elif current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    update_data = project_update.model_dump(exclude_unset=True)
    
    # Handle tags update
    if 'tag_ids' in update_data:
        tag_ids = update_data.pop('tag_ids')
        if tag_ids is not None:
            tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
            project.tags = tags
    
    for key, value in update_data.items():
        setattr(project, key, value)
    
    db.commit()
    db.refresh(project)
    
    return project


@router.put("/{project_id}/status", response_model=ProjectResponse)
async def update_project_status(
    project_id: int,
    status_update: ProjectStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update project status (admin only)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    old_status = project.status
    project.status = status_update.status.value
    if status_update.poster_number:
        project.poster_number = status_update.poster_number
    
    db.commit()
    db.refresh(project)
    
    # Send notification if status changed
    if old_status != project.status:
        from app.models import NotificationType
        
        if project.status == ProjectStatus.APPROVED.value:
            notification = NotificationCreate(
                user_id=project.student_id,
                type=NotificationType.PROJECT_APPROVED,
                title="Project Approved!",
                message=f'Your project "{project.title}" has been approved.',
                link=f"/projects/{project.id}"
            )
        elif project.status == ProjectStatus.REJECTED.value:
            notification = NotificationCreate(
                user_id=project.student_id,
                type=NotificationType.PROJECT_REJECTED,
                title="Project Status Update",
                message=f'Your project "{project.title}" was not approved.',
                link=f"/projects/{project.id}"
            )
        else:
            notification = None
        
        if notification:
            create_notification(db, notification)
    
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete project (student owner or admin)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check permissions
    if current_user.role == UserRole.STUDENT.value:
        if project.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    elif current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    db.delete(project)
    db.commit()
    
    return None


async def save_uploaded_file(file: UploadFile, folder: str) -> str:
    """Helper to save uploaded file"""
    ext = file.filename.split(".")[-1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type .{ext} not allowed"
        )
    
    upload_dir = os.path.join(settings.UPLOAD_DIR, folder)
    os.makedirs(upload_dir, exist_ok=True)
    
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(upload_dir, filename)
    
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE // (1024*1024)}MB limit"
        )
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    return file_path


@router.post("/{project_id}/paper", response_model=ProjectResponse)
async def upload_paper(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload paper for project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if current_user.role == UserRole.STUDENT.value and project.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    file_path = await save_uploaded_file(file, "papers")
    project.paper_path = file_path
    db.commit()
    db.refresh(project)
    
    return project


@router.post("/{project_id}/slides", response_model=ProjectResponse)
async def upload_slides(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload slides for project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if current_user.role == UserRole.STUDENT.value and project.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    file_path = await save_uploaded_file(file, "slides")
    project.slides_path = file_path
    db.commit()
    db.refresh(project)
    
    return project


@router.post("/{project_id}/docs", response_model=ProjectResponse)
async def upload_additional_docs(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload additional documents for project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if current_user.role == UserRole.STUDENT.value and project.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    file_path = await save_uploaded_file(file, "docs")
    project.additional_docs_path = file_path
    db.commit()
    db.refresh(project)
    
    return project


@router.get("/{project_id}/paper/download")
async def download_paper(
    project_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """Download paper for project (authenticated users)"""
    # Verify token
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    # Check access permissions
    if user.role == UserRole.STUDENT.value and project.student_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        if project.status != ProjectStatus.APPROVED.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project not yet approved")
    
    if not project.paper_path or not os.path.exists(project.paper_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")
    
    filename = f"{project.title.replace(' ', '_')}_paper{os.path.splitext(project.paper_path)[1]}"
    return FileResponse(project.paper_path, filename=filename, media_type='application/octet-stream')


@router.get("/{project_id}/slides/download")
async def download_slides(
    project_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """Download slides for project (authenticated users)"""
    # Verify token
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    # Check access permissions
    if user.role == UserRole.STUDENT.value and project.student_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        if project.status != ProjectStatus.APPROVED.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project not yet approved")
    
    if not project.slides_path or not os.path.exists(project.slides_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slides not found")
    
    filename = f"{project.title.replace(' ', '_')}_slides{os.path.splitext(project.slides_path)[1]}"
    return FileResponse(project.slides_path, filename=filename, media_type='application/octet-stream')


@router.get("/{project_id}/docs/download")
async def download_docs(
    project_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """Download additional docs for project (authenticated users)"""
    # Verify token
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    # Check access permissions
    if user.role == UserRole.STUDENT.value and project.student_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        if project.status != ProjectStatus.APPROVED.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project not yet approved")
    
    if not project.additional_docs_path or not os.path.exists(project.additional_docs_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Additional documents not found")
    
    filename = f"{project.title.replace(' ', '_')}_docs{os.path.splitext(project.additional_docs_path)[1]}"
    return FileResponse(project.additional_docs_path, filename=filename, media_type='application/octet-stream')


@router.delete("/{project_id}/paper", response_model=ProjectResponse)
async def delete_paper(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete paper from project (owner or admin)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    if project.student_id != current_user.id and current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    if project.paper_path:
        file_to_delete = os.path.join(settings.UPLOAD_DIR, project.paper_path.replace("/uploads/", ""))
        if os.path.exists(file_to_delete):
            os.remove(file_to_delete)
        project.paper_path = None
        db.commit()
        db.refresh(project)
    
    return project


@router.delete("/{project_id}/slides", response_model=ProjectResponse)
async def delete_slides(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete slides from project (owner or admin)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    if project.student_id != current_user.id and current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    if project.slides_path:
        file_to_delete = os.path.join(settings.UPLOAD_DIR, project.slides_path.replace("/uploads/", ""))
        if os.path.exists(file_to_delete):
            os.remove(file_to_delete)
        project.slides_path = None
        db.commit()
        db.refresh(project)
    
    return project


@router.delete("/{project_id}/docs", response_model=ProjectResponse)
async def delete_docs(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete additional docs from project (owner or admin)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    if project.student_id != current_user.id and current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    if project.additional_docs_path:
        file_to_delete = os.path.join(settings.UPLOAD_DIR, project.additional_docs_path.replace("/uploads/", ""))
        if os.path.exists(file_to_delete):
            os.remove(file_to_delete)
        project.additional_docs_path = None
        db.commit()
        db.refresh(project)
    
    return project


@router.put("/{project_id}/reassign-student/{student_id}", response_model=ProjectResponse)
async def reassign_project_student(
    project_id: int,
    student_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reassign project to a different student (admin only)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    student = db.query(User).filter(
        User.id == student_id,
        User.role == UserRole.STUDENT.value
    ).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    project.student_id = student_id
    db.commit()
    db.refresh(project)
    
    return project


@router.put("/{project_id}/reassign-session", response_model=ProjectResponse)
async def reassign_project_session(
    project_id: int,
    session_id: int = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reassign project to a different session or remove from session (admin only)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if session_id:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
    
    project.session_id = session_id
    db.commit()
    db.refresh(project)
    
    return project

@router.get("/{project_id}/reviewers")
async def get_project_reviewers(
    project_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get reviewers assigned to a project (admin only)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return [{"id": r.id, "full_name": r.full_name, "email": r.email, "role": r.role} for r in project.assigned_reviewers]


@router.post("/{project_id}/reviewers/{reviewer_id}")
async def assign_reviewer_to_project(
    project_id: int,
    reviewer_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Assign a reviewer to a project (admin only)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    reviewer = db.query(User).filter(
        User.id == reviewer_id,
        User.role.in_([UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value])
    ).first()
    if not reviewer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reviewer not found"
        )
    
    if not reviewer.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviewer is not approved"
        )
    
    if reviewer in project.assigned_reviewers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviewer already assigned to this project"
        )
    
    # Check 4-project limit per session
    if project.session_id:
        session_assignments = sum(
            1 for p in reviewer.assigned_projects if p.session_id == project.session_id
        )
        if session_assignments >= 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reviewer has reached the maximum of 4 projects for this session"
            )
    
    project.assigned_reviewers.append(reviewer)
    db.commit()
    
    return {"message": "Reviewer assigned successfully"}


@router.delete("/{project_id}/reviewers/{reviewer_id}")
async def unassign_reviewer_from_project(
    project_id: int,
    reviewer_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove a reviewer from a project (admin only)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    reviewer = db.query(User).filter(User.id == reviewer_id).first()
    if not reviewer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reviewer not found"
        )
    
    if reviewer not in project.assigned_reviewers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviewer is not assigned to this project"
        )
    
    project.assigned_reviewers.remove(reviewer)
    db.commit()
    
    return {"message": "Reviewer unassigned successfully"}


@router.get("/{project_id}/team-members")
async def get_project_team_members(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get team members of a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check permissions - admin, project owner, or team member
    if current_user.role != UserRole.ADMIN.value:
        if project.student_id != current_user.id and current_user not in project.team_members:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    return [{"id": m.id, "full_name": m.full_name, "email": m.email} for m in project.team_members]


@router.post("/{project_id}/team-members/{student_id}")
async def add_team_member(
    project_id: int,
    student_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add a student as team member to a project (admin only)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    student = db.query(User).filter(
        User.id == student_id,
        User.role == UserRole.STUDENT.value
    ).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Cannot add the project owner as team member
    if student_id == project.student_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add project owner as team member"
        )
    
    if student in project.team_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is already a team member"
        )
    
    project.team_members.append(student)
    db.commit()
    
    return {"message": "Team member added successfully"}


@router.delete("/{project_id}/team-members/{student_id}")
async def remove_team_member(
    project_id: int,
    student_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove a team member from a project (admin only)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    if student not in project.team_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is not a team member of this project"
        )
    
    project.team_members.remove(student)
    db.commit()
    
    return {"message": "Team member removed successfully"}