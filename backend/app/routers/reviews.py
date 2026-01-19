from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import (
    Review, CriteriaScore, Project, Criteria, User, UserRole, ProjectStatus, NotificationType
)
from app.schemas import (
    ReviewCreate, ReviewUpdate, ReviewResponse, NotificationCreate
)
from app.auth import get_current_user, require_reviewer, require_admin
from app.routers.notifications import create_notification

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.get("/project/{project_id}", response_model=List[ReviewResponse])
async def list_reviews_for_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all reviews for a project"""
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
        # Students can only see completed reviews
        return db.query(Review).filter(
            Review.project_id == project_id,
            Review.is_completed == True
        ).all()
    
    return db.query(Review).filter(Review.project_id == project_id).all()


@router.get("/my", response_model=List[ReviewResponse])
async def get_my_reviews(
    is_completed: bool = None,
    current_user: User = Depends(require_reviewer),
    db: Session = Depends(get_db)
):
    """Get current reviewer's reviews"""
    query = db.query(Review).filter(Review.reviewer_id == current_user.id)
    
    if is_completed is not None:
        query = query.filter(Review.is_completed == is_completed)
    
    return query.all()


@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get review by ID"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    # Check permissions
    if current_user.role == UserRole.STUDENT.value:
        if review.project.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        if not review.is_completed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Review not yet completed"
            )
    elif current_user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        if review.reviewer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    return review


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(require_reviewer),
    db: Session = Depends(get_db)
):
    """Create a new review (reviewers only)"""
    # Check project exists and is approved
    project = db.query(Project).filter(Project.id == review_data.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if project.status != ProjectStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot review unapproved project"
        )
    
    # Check reviewer is assigned to this project
    if current_user not in project.assigned_reviewers:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to review this project"
        )
    
    # Check reviewer hasn't exceeded max reviews per session (limit: 4)
    if project.session_id:
        reviews_in_session = db.query(Review).join(Project).filter(
            Project.session_id == project.session_id,
            Review.reviewer_id == current_user.id
        ).count()
        if reviews_in_session >= 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have reached the maximum of 4 reviews for this session"
            )
    
    # Check for existing review
    existing = db.query(Review).filter(
        Review.project_id == review_data.project_id,
        Review.reviewer_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this project"
        )
    
    # Validate criteria scores
    session_criteria = db.query(Criteria).filter(
        Criteria.session_id == project.session_id
    ).all()
    session_criteria_ids = {c.id for c in session_criteria}
    
    for score in review_data.criteria_scores:
        if score.criteria_id not in session_criteria_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid criteria ID: {score.criteria_id}"
            )
        criteria = next(c for c in session_criteria if c.id == score.criteria_id)
        if score.score > criteria.max_score:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Score exceeds max for criteria {criteria.name}"
            )
    
    # Create review
    review = Review(
        project_id=review_data.project_id,
        reviewer_id=current_user.id,
        comments=review_data.comments
    )
    db.add(review)
    db.flush()
    
    # Add criteria scores
    total_weighted_score = 0
    total_weight = 0
    
    for score_data in review_data.criteria_scores:
        criteria = next(c for c in session_criteria if c.id == score_data.criteria_id)
        score = CriteriaScore(
            review_id=review.id,
            criteria_id=score_data.criteria_id,
            score=score_data.score
        )
        db.add(score)
        
        # Calculate weighted score
        normalized = score_data.score / criteria.max_score
        total_weighted_score += normalized * criteria.weight
        total_weight += criteria.weight
    
    # Calculate total score
    if total_weight > 0:
        review.total_score = (total_weighted_score / total_weight) * 100
    
    db.commit()
    db.refresh(review)
    
    # Send notification to student
    notification = NotificationCreate(
        user_id=project.student_id,
        type=NotificationType.REVIEW_SUBMITTED,
        title="New Review Received",
        message=f'Your project "{project.title}" has received a new review.',
        link=f"/projects/{project.id}"
    )
    create_notification(db, notification)
    
    return review


@router.put("/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: int,
    review_update: ReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update review (reviewer owner or admin)"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    # Check permissions
    if current_user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        if review.reviewer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        if review.is_completed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update completed review"
            )
    elif current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    update_data = review_update.model_dump(exclude_unset=True)
    
    # Handle criteria scores update
    if 'criteria_scores' in update_data and update_data['criteria_scores']:
        # Delete existing scores
        db.query(CriteriaScore).filter(CriteriaScore.review_id == review_id).delete()
        
        session_criteria = db.query(Criteria).filter(
            Criteria.session_id == review.project.session_id
        ).all()
        
        total_weighted_score = 0
        total_weight = 0
        
        for score_data in update_data['criteria_scores']:
            criteria = next((c for c in session_criteria if c.id == score_data['criteria_id']), None)
            if not criteria:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid criteria ID: {score_data['criteria_id']}"
                )
            
            score = CriteriaScore(
                review_id=review.id,
                criteria_id=score_data['criteria_id'],
                score=score_data['score']
            )
            db.add(score)
            
            normalized = score_data['score'] / criteria.max_score
            total_weighted_score += normalized * criteria.weight
            total_weight += criteria.weight
        
        if total_weight > 0:
            review.total_score = (total_weighted_score / total_weight) * 100
        
        del update_data['criteria_scores']
    
    for key, value in update_data.items():
        setattr(review, key, value)
    
    db.commit()
    db.refresh(review)
    
    return review


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete review (admin only)"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    db.delete(review)
    db.commit()
    
    return None
