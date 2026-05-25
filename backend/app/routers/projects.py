from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
from jose import jwt, JWTError

from app.database import get_db
from app.models import Project, User, UserRole, Tag, ProjectStatus, Session as SessionModel, NotificationType, ProjectTeamInvitation, TeamInvitationStatus
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
    from sqlalchemy import or_
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
            Review.is_completed == True  # noqa: E712
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
            "advisor_email": project.advisor_email,
            "supervisor1_email": project.supervisor1_email,
            "supervisor2_email": project.supervisor2_email,
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
        User.is_approved == True,  # noqa: E712
        User.is_active == True  # noqa: E712
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

    # Build reviewer -> set of touched session ids across ALL approved projects
    # (independent of the optional session_id filter on this endpoint, so the
    # UI can always tell when a reviewer is assigned in every session).
    from app.models import project_reviewers as project_reviewers_table
    touched_rows = (
        db.query(project_reviewers_table.c.user_id, Project.session_id)
        .join(Project, Project.id == project_reviewers_table.c.project_id)
        .filter(
            Project.status == ProjectStatus.APPROVED.value,
            Project.session_id.isnot(None),
        )
        .all()
    )
    reviewer_touched_sessions: dict[int, set[int]] = {}
    for user_id, sid in touched_rows:
        reviewer_touched_sessions.setdefault(user_id, set()).add(sid)

    return [
        {
            "id": p.id,
            "title": p.title,
            "poster_number": p.poster_number,
            "session_id": p.session_id,
            "session_name": p.session.name if p.session else None,
            "student_name": p.student.full_name,
            "student_email": p.student.email,
            "team_members": [
                {"id": tm.id, "full_name": tm.full_name, "email": tm.email}
                for tm in p.team_members
            ],
            "advisor_email": p.advisor_email,
            "supervisor1_email": p.supervisor1_email,
            "supervisor2_email": p.supervisor2_email,
            "tags": [{"id": t.id, "name": t.name} for t in p.tags],
            "assigned_reviewers": [
                {
                    "id": r.id,
                    "full_name": r.full_name,
                    "email": r.email,
                    "tag_ids": [t.id for t in r.interested_tags],
                    "touched_session_ids": sorted(reviewer_touched_sessions.get(r.id, set())),
                }
                for r in p.assigned_reviewers
            ],
            "reviews_count": len([r for r in p.reviews if r.is_completed])
        }
        for p in projects
    ]


@router.post("/assignments/auto-assign")
async def auto_assign_reviewers(
    session_id: int = Query(None, description="Session ID to limit assignment to (single, kept for backwards compatibility)"),
    session_ids: list[int] = Query(None, description="Restrict to projects in these session IDs (multi-select)"),
    reviewer_ids: list[int] = Query(None, description="Restrict the reviewer pool to these user IDs"),
    reviewers_per_project: int = Query(None, description="Reviewers per project (default from settings or 2)"),
    max_per_session: int = Query(None, description="Max projects a reviewer can review per session (default from settings or 3)"),
    max_total: int = Query(None, description="Max projects a reviewer can review across all sessions (default from settings or 9)"),
    require_untouched_session: bool = Query(True, description="Rule 7: enforce that every reviewer keeps at least one session entirely empty"),
    preview: bool = Query(False, description="If true, return proposed assignments without applying"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Automatically assign reviewers to projects under the following rules:

    1. Each project receives `reviewers_per_project` reviewers (default 2).
    2. The first reviewer (X) must be one of the project's two supervisors
       (`supervisor1_email`, `supervisor2_email`).
    3. Reviewer Y cannot be the *other* supervisor.
    4. Reviewer Y cannot be the project's advisor (`advisor_email`).
    5. A reviewer may be assigned to at most `max_per_session` projects per session.
    6. A reviewer may be assigned to at most `max_total` projects across all sessions.
    7. Every reviewer must keep at least one session in the system where they have
       no assignments (across-all-sessions interpretation).
    8. Tag/interest overlap is used only as a tie-breaker after the hard rules.

    Projects whose supervisors are missing/invalid (or whose constraints are
    unsatisfiable) are skipped and reported as `unassignable_projects`.
    """
    from app.models import SiteSettings

    # --- Resolve config: query param > site_settings > hard-coded default ----
    def _get_setting_int(key: str, fallback: int) -> int:
        s = db.query(SiteSettings).filter(SiteSettings.key == key).first()
        if s and s.value:
            try:
                return int(s.value)
            except (TypeError, ValueError):
                pass
        return fallback

    if reviewers_per_project is None:
        reviewers_per_project = _get_setting_int("auto_assign_reviewers_per_project", 2)
    if max_per_session is None:
        max_per_session = _get_setting_int("auto_assign_max_per_session", 3)
    if max_total is None:
        max_total = _get_setting_int("auto_assign_max_total", 9)

    if reviewers_per_project < 1:
        raise HTTPException(status_code=400, detail="reviewers_per_project must be >= 1")

    # --- Load projects in scope --------------------------------------------
    project_query = db.query(Project).filter(Project.status == ProjectStatus.APPROVED.value)
    # Combine the single session_id (legacy) with the multi-select session_ids.
    scope_session_ids: set[int] = set()
    if session_id is not None:
        scope_session_ids.add(session_id)
    if session_ids:
        scope_session_ids.update(session_ids)
    if scope_session_ids:
        project_query = project_query.filter(Project.session_id.in_(scope_session_ids))
    projects = project_query.order_by(Project.id.asc()).all()

    # --- Load all approved active reviewers --------------------------------
    reviewer_query = db.query(User).filter(
        User.role.in_([UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]),
        User.is_approved == True,  # noqa: E712
        User.is_active == True,  # noqa: E712
    )
    if reviewer_ids:
        reviewer_query = reviewer_query.filter(User.id.in_(reviewer_ids))
    reviewers = reviewer_query.all()
    if not reviewers:
        raise HTTPException(status_code=400, detail="No approved reviewers available")

    reviewers_by_email = {r.email.lower(): r for r in reviewers if r.email}

    # --- Universe of sessions (for rule 7) ---------------------------------
    all_session_ids = {sid for (sid,) in db.query(SessionModel.id).all()}
    total_sessions = len(all_session_ids)

    # --- Precompute current state for every reviewer -----------------------
    per_session_count: dict[int, dict[int, int]] = {}  # reviewer_id -> {session_id -> count}
    total_count: dict[int, int] = {}  # reviewer_id -> total assignments (across all sessions)
    touched_sessions: dict[int, set[int]] = {}  # reviewer_id -> set of session_ids assigned to

    for r in reviewers:
        sess_counts: dict[int, int] = {}
        touched: set[int] = set()
        for p in r.assigned_projects:
            sid = p.session_id or 0
            sess_counts[sid] = sess_counts.get(sid, 0) + 1
            if p.session_id is not None:
                touched.add(p.session_id)
        per_session_count[r.id] = sess_counts
        total_count[r.id] = len(r.assigned_projects)
        touched_sessions[r.id] = touched

    def can_take(reviewer: User, project_session_id: int | None) -> bool:
        """Check rules 5, 6, 7 for assigning this reviewer to a project in
        `project_session_id` (may be None if the project has no session)."""
        # Rule 6: total cap
        if total_count[reviewer.id] >= max_total:
            return False
        # Rule 5: per-session cap (only meaningful when the project has a session)
        if project_session_id is not None:
            if per_session_count[reviewer.id].get(project_session_id, 0) >= max_per_session:
                return False
        # Rule 7: must keep at least one untouched session in the system (configurable)
        if require_untouched_session and project_session_id is not None and total_sessions > 0:
            new_touched = touched_sessions[reviewer.id] | {project_session_id}
            # After this assignment, reviewer would have len(new_touched) touched sessions;
            # they must have at least one fully-empty session, so touched < total_sessions.
            if len(new_touched) >= total_sessions:
                return False
        return True

    def commit_pick(reviewer: User, project: Project) -> None:
        sid = project.session_id
        if sid is not None:
            per_session_count[reviewer.id][sid] = per_session_count[reviewer.id].get(sid, 0) + 1
            touched_sessions[reviewer.id].add(sid)
        else:
            per_session_count[reviewer.id][0] = per_session_count[reviewer.id].get(0, 0) + 1
        total_count[reviewer.id] += 1

    def tag_score(reviewer: User, project_tag_ids: set[int]) -> int:
        return len({t.id for t in reviewer.interested_tags} & project_tag_ids)

    def would_exhaust_sessions(reviewer: User, project_session_id: int | None) -> int:
        """Soft Rule 7: return 1 if assigning this reviewer to project_session_id
        would leave them with zero untouched sessions, else 0. Used as a sort
        tiebreaker so picks that preserve at least one empty session are preferred
        even when the hard rule is disabled."""
        if project_session_id is None or total_sessions == 0:
            return 0
        new_touched = touched_sessions[reviewer.id] | {project_session_id}
        return 1 if len(new_touched) >= total_sessions else 0

    def opens_new_session(reviewer: User, project_session_id: int | None) -> int:
        """Return 1 if assigning this reviewer to project_session_id would add
        a session they don't currently touch, else 0. Strong soft preference to
        re-use a reviewer's existing sessions before spreading them into new
        ones — this keeps as many sessions untouched as the data allows."""
        if project_session_id is None:
            return 0
        return 0 if project_session_id in touched_sessions[reviewer.id] else 1

    # --- Assignment loop ---------------------------------------------------
    proposed_assignments: list[dict] = []
    unassignable: list[dict] = []
    assignments_made = 0

    for project in projects:
        project_tag_ids = {t.id for t in project.tags}
        already_assigned_ids = {r.id for r in project.assigned_reviewers}
        already_assigned_emails = {r.email.lower() for r in project.assigned_reviewers if r.email}

        # Resolve supervisors & advisor (by email -> reviewer user)
        sup1 = reviewers_by_email.get((project.supervisor1_email or "").lower()) if project.supervisor1_email else None
        sup2 = reviewers_by_email.get((project.supervisor2_email or "").lower()) if project.supervisor2_email else None
        advisor_user = reviewers_by_email.get((project.advisor_email or "").lower()) if project.advisor_email else None
        # Advisor exclusion uses email regardless of whether the advisor is a reviewer
        advisor_email_lc = (project.advisor_email or "").lower()

        supervisors = [s for s in (sup1, sup2) if s is not None]
        if not supervisors:
            unassignable.append({
                "project_id": project.id,
                "title": project.title,
                "reason": "No valid supervisor (must be an approved reviewer matching supervisor1_email or supervisor2_email).",
            })
            continue

        # ---- Pick X: must be a supervisor (rule 2) ------------------------
        # If a supervisor is already assigned, use them as X.
        x_picked: User | None = None
        for s in supervisors:
            if s.id in already_assigned_ids:
                x_picked = s
                break

        if x_picked is None:
            # Pick the supervisor with the lowest current load that can take it.
            sup_candidates = [
                s for s in supervisors
                if s.id not in already_assigned_ids and can_take(s, project.session_id)
            ]
            sup_candidates.sort(
                key=lambda s: (
                    would_exhaust_sessions(s, project.session_id),
                    opens_new_session(s, project.session_id),
                    total_count[s.id],
                    per_session_count[s.id].get(project.session_id or 0, 0),
                )
            )
            if sup_candidates:
                x_picked = sup_candidates[0]
                commit_pick(x_picked, project)
                proposed_assignments.append({
                    "project_id": project.id,
                    "reviewer_id": x_picked.id,
                    "reviewer_name": x_picked.full_name,
                    "role": "supervisor",
                })
                assignments_made += 1
                if not preview:
                    project.assigned_reviewers.append(x_picked)
                already_assigned_ids.add(x_picked.id)
                if x_picked.email:
                    already_assigned_emails.add(x_picked.email.lower())
            else:
                unassignable.append({
                    "project_id": project.id,
                    "title": project.title,
                    "reason": "No supervisor available within configured limits (rules 5/6/7).",
                })
                continue

        # ---- Pick remaining reviewers (Y, etc.) ---------------------------
        other_supervisor_ids = {s.id for s in supervisors if s.id != x_picked.id}
        slots_remaining = max(0, reviewers_per_project - len(already_assigned_ids))

        # Build exclusion set for Y candidates (rules 3 & 4 + already-assigned).
        for _slot in range(slots_remaining):
            candidates = []
            for r in reviewers:
                if r.id in already_assigned_ids:
                    continue
                if r.id in other_supervisor_ids:  # rule 3
                    continue
                if advisor_email_lc and r.email and r.email.lower() == advisor_email_lc:  # rule 4
                    continue
                if not can_take(r, project.session_id):
                    continue
                candidates.append(r)

            if not candidates:
                unassignable.append({
                    "project_id": project.id,
                    "title": project.title,
                    "reason": f"Could not fill all {reviewers_per_project} reviewer slots given the constraints.",
                })
                break

            # Sort:
            #  1. soft Rule 7: never the last untouched session of this reviewer
            #  2. re-use sessions: prefer reviewers already touching this session
            #  3. higher tag score (rule 8)
            #  4. lower load (fairness)
            candidates.sort(
                key=lambda r: (
                    would_exhaust_sessions(r, project.session_id),
                    opens_new_session(r, project.session_id),
                    -tag_score(r, project_tag_ids),
                    total_count[r.id],
                    per_session_count[r.id].get(project.session_id or 0, 0),
                    r.id,
                )
            )
            pick = candidates[0]
            commit_pick(pick, project)
            proposed_assignments.append({
                "project_id": project.id,
                "reviewer_id": pick.id,
                "reviewer_name": pick.full_name,
                "role": "reviewer",
            })
            assignments_made += 1
            if not preview:
                project.assigned_reviewers.append(pick)
            already_assigned_ids.add(pick.id)
            if pick.email:
                already_assigned_emails.add(pick.email.lower())

    if not preview:
        db.commit()

    message_prefix = "Preview: " if preview else ""
    return {
        "message": f"{message_prefix}{assignments_made} assignments {'would be' if preview else ''} made.".strip(),
        "assignments_count": assignments_made,
        "assignments_made": assignments_made,
        "proposed_assignments": proposed_assignments,
        "unassignable_projects": unassignable,
        "config": {
            "reviewers_per_project": reviewers_per_project,
            "max_per_session": max_per_session,
            "max_total": max_total,
            "require_untouched_session": require_untouched_session,
        },
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


@router.get("/advised", response_model=List[ProjectWithStudent])
async def get_advised_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get projects where the current user is listed as the advisor (by email).

    Available to reviewers (internal/external) and admins.
    """
    if current_user.role not in [
        UserRole.INTERNAL_REVIEWER.value,
        UserRole.EXTERNAL_REVIEWER.value,
        UserRole.ADMIN.value,
    ]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reviewers or admins can view advised projects",
        )

    if not current_user.email:
        return []

    projects = (
        db.query(Project)
        .filter(Project.advisor_email.ilike(current_user.email))
        .order_by(Project.created_at.desc())
        .all()
    )
    return projects


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
        advisor_email=project_data.advisor_email,
        supervisor1_email=project_data.supervisor1_email,
        supervisor2_email=project_data.supervisor2_email,
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
            link="/projects"
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
            link="/admin/projects"
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