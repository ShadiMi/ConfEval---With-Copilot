from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Criteria, Session as SessionModel, User
from app.schemas import CriteriaCreate, CriteriaUpdate, CriteriaResponse
from app.auth import get_current_user, require_admin

router = APIRouter(prefix="/criteria", tags=["Criteria"])


@router.get("/session/{session_id}", response_model=List[CriteriaResponse])
async def list_criteria_for_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all criteria for a session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    return db.query(Criteria).filter(
        Criteria.session_id == session_id
    ).order_by(Criteria.order).all()


@router.get("/{criteria_id}", response_model=CriteriaResponse)
async def get_criteria(
    criteria_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get criteria by ID"""
    criteria = db.query(Criteria).filter(Criteria.id == criteria_id).first()
    if not criteria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criteria not found"
        )
    return criteria


@router.post("", response_model=CriteriaResponse, status_code=status.HTTP_201_CREATED)
async def create_criteria(
    criteria_data: CriteriaCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create new criteria (admin only)"""
    # Check session exists
    session = db.query(SessionModel).filter(SessionModel.id == criteria_data.session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Get next order number
    max_order = db.query(Criteria).filter(
        Criteria.session_id == criteria_data.session_id
    ).count()
    
    # Exclude order from model_dump and set it separately
    data = criteria_data.model_dump(exclude={'order'})
    criteria = Criteria(
        **data,
        order=criteria_data.order if criteria_data.order is not None else max_order
    )
    
    db.add(criteria)
    db.commit()
    db.refresh(criteria)
    
    return criteria


@router.put("/{criteria_id}", response_model=CriteriaResponse)
async def update_criteria(
    criteria_id: int,
    criteria_update: CriteriaUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update criteria (admin only)"""
    criteria = db.query(Criteria).filter(Criteria.id == criteria_id).first()
    if not criteria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criteria not found"
        )
    
    update_data = criteria_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(criteria, key, value)
    
    db.commit()
    db.refresh(criteria)
    
    return criteria


@router.delete("/{criteria_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_criteria(
    criteria_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete criteria (admin only)"""
    criteria = db.query(Criteria).filter(Criteria.id == criteria_id).first()
    if not criteria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criteria not found"
        )
    
    db.delete(criteria)
    db.commit()
    
    return None


@router.put("/session/{session_id}/reorder")
async def reorder_criteria(
    session_id: int,
    criteria_order: List[int],  # List of criteria IDs in new order
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reorder criteria for a session (admin only)"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    criteria_list = db.query(Criteria).filter(Criteria.session_id == session_id).all()
    criteria_ids = {c.id for c in criteria_list}
    
    if set(criteria_order) != criteria_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Criteria IDs don't match session criteria"
        )
    
    for order, criteria_id in enumerate(criteria_order):
        db.query(Criteria).filter(Criteria.id == criteria_id).update({"order": order})
    
    db.commit()
    
    return {"message": "Criteria reordered successfully"}
