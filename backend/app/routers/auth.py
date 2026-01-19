from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import os
import uuid

from app.database import get_db
from app.models import User, UserRole, Tag, SiteSettings, NotificationType
from app.schemas import (
    UserCreate, UserResponse, UserUpdate, UserWithTags,
    LoginRequest, Token, TagResponse, NotificationCreate
)
from app.routers.notifications import create_notification
from app.auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_admin
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(...),
    role: str = Form(...),
    affiliation: Optional[str] = Form(None),
    id_number: Optional[str] = Form(None),
    phone_number: Optional[str] = Form(None),
    cv: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Register a new user"""
    # Validate id_number if provided
    if id_number and (len(id_number) != 9 or not id_number.isdigit()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID number must be exactly 9 digits"
        )
    
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Validate role
    try:
        user_role = UserRole[role.upper()]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )
    
    # Validate external reviewer requirements
    if user_role == UserRole.EXTERNAL_REVIEWER:
        if not affiliation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="External reviewers must provide affiliation"
            )
        if not cv:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="External reviewers must upload CV during registration"
            )
    
    # Process CV if uploaded
    cv_path = None
    if cv:
        # Validate file type
        ext = cv.filename.split(".")[-1].lower()
        if ext not in {"pdf", "doc", "docx"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CV must be PDF, DOC, or DOCX"
            )
        
        # Create upload directory
        upload_dir = os.path.join(settings.UPLOAD_DIR, "cvs")
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save file
        filename = f"{uuid.uuid4()}.{ext}"
        file_path = os.path.join(upload_dir, filename)
        
        content = await cv.read()
        if len(content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds {settings.MAX_FILE_SIZE // (1024*1024)}MB limit"
            )
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        cv_path = file_path
    
    # Reviewers need approval, students are auto-approved
    needs_approval = user_role in [UserRole.INTERNAL_REVIEWER, UserRole.EXTERNAL_REVIEWER]
    
    # For internal reviewers, get default affiliation from settings
    user_affiliation = affiliation
    if user_role == UserRole.INTERNAL_REVIEWER:
        default_affiliation = db.query(SiteSettings).filter(
            SiteSettings.key == "internal_reviewer_affiliation"
        ).first()
        if default_affiliation:
            user_affiliation = default_affiliation.value
    
    # Create user
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=get_password_hash(password),
        role=user_role.value,
        affiliation=user_affiliation,
        id_number=id_number,
        phone_number=phone_number,
        cv_path=cv_path,
        is_approved=not needs_approval  # Students approved, reviewers need approval
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Notify admins if a reviewer registered (needs approval)
    if needs_approval:
        admins = db.query(User).filter(User.role == UserRole.ADMIN.value).all()
        role_label = "Internal Reviewer" if user_role == UserRole.INTERNAL_REVIEWER else "External Reviewer"
        for admin in admins:
            notification = NotificationCreate(
                user_id=admin.id,
                type=NotificationType.GENERAL,
                title="New Reviewer Registration",
                message=f'{user.full_name} has registered as {role_label} and needs approval.',
                link="/admin/users"
            )
            create_notification(db, notification)
    
    return user


@router.post("/login", response_model=Token)
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Login and get access token"""
    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Check if reviewer is approved
    if user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        if not user.is_approved:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your reviewer account is pending approval. Please wait for an administrator to approve your account."
            )
    
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role}
    )
    
    return Token(access_token=access_token)


@router.get("/me", response_model=UserWithTags)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile"""
    if user_update.full_name:
        current_user.full_name = user_update.full_name
    if user_update.affiliation is not None:
        current_user.affiliation = user_update.affiliation
    if user_update.id_number is not None:
        current_user.id_number = user_update.id_number
    if user_update.phone_number is not None:
        current_user.phone_number = user_update.phone_number
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.post("/me/cv", response_model=UserResponse)
async def upload_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload CV (for reviewers)"""
    if current_user.role not in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reviewers can upload CVs"
        )
    
    # Validate file type
    ext = file.filename.split(".")[-1].lower()
    if ext not in {"pdf", "doc", "docx"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, DOC, DOCX files are allowed"
        )
    
    # Create upload directory
    upload_dir = os.path.join(settings.UPLOAD_DIR, "cvs")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save file
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
    
    # Update user
    current_user.cv_path = file_path
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.get("/users/{user_id}/cv")
async def download_cv(
    user_id: int,
    token: str = None,
    db: Session = Depends(get_db)
):
    """Download user's CV (admin only)"""
    from jose import JWTError, jwt
    from app.config import settings
    
    # Verify token from query param (for direct download links)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_from_token = payload.get("sub")
        role = payload.get("role")
        if user_id_from_token is None or role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.cv_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has no CV uploaded"
        )
    
    if not os.path.exists(user.cv_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CV file not found"
        )
    
    # Get file extension for proper filename
    ext = user.cv_path.split(".")[-1]
    filename = f"{user.full_name.replace(' ', '_')}_CV.{ext}"
    
    return FileResponse(
        path=user.cv_path,
        filename=filename,
        media_type="application/octet-stream"
    )


@router.put("/me/tags", response_model=UserWithTags)
async def update_interested_tags(
    tag_ids: List[int],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update interested tags (for reviewers)"""
    if current_user.role not in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reviewers can set interested tags"
        )
    
    # Get tags
    tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    if len(tags) != len(tag_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some tag IDs are invalid"
        )
    
    current_user.interested_tags = tags
    db.commit()
    db.refresh(current_user)
    
    return current_user


# Admin endpoints for user management
@router.get("/users/pending-count")
async def get_pending_approval_count(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get count of users pending approval (admin only)"""
    count = db.query(User).filter(
        User.role.in_([UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]),
        User.is_approved == False
    ).count()
    return {"pending_count": count}


@router.get("/users", response_model=List[UserWithTags])
async def list_users(
    role: str = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all users (admin only)"""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.offset(skip).limit(limit).all()


@router.get("/users/{user_id}", response_model=UserWithTags)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get user by ID (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: int,
    is_active: bool,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Activate/deactivate user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_active = is_active
    db.commit()
    
    return {"message": f"User {'activated' if is_active else 'deactivated'} successfully"}


@router.put("/users/{user_id}/approve")
async def approve_reviewer(
    user_id: int,
    is_approved: bool,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve/reject reviewer account (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.role not in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only reviewer accounts can be approved"
        )
    
    user.is_approved = is_approved
    db.commit()
    
    return {"message": f"Reviewer {'approved' if is_approved else 'rejected'} successfully"}


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    role: str = Query(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update user role (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )
    
    # Validate role
    try:
        new_role = UserRole(role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )
    
    user.role = new_role.value
    
    # If changing to reviewer, set is_approved to True (admin is making the change)
    if new_role in [UserRole.INTERNAL_REVIEWER, UserRole.EXTERNAL_REVIEWER]:
        user.is_approved = True
    
    db.commit()
    
    return {"message": f"User role updated to {role}"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    if user.role == UserRole.ADMIN.value:
        # Check if there's at least one other admin
        admin_count = db.query(User).filter(User.role == UserRole.ADMIN.value).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last admin account"
            )
    
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted successfully"}


# Google OAuth
class GoogleAuthRequest(BaseModel):
    token: str  # Google ID token
    role: Optional[str] = "student"


@router.post("/google", response_model=Token)
async def google_auth(
    auth_data: GoogleAuthRequest,
    db: Session = Depends(get_db)
):
    """Authenticate with Google OAuth"""
    from google.oauth2 import id_token
    from google.auth.transport import requests
    
    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            auth_data.token,
            requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
        
        google_id = idinfo['sub']
        email = idinfo['email']
        full_name = idinfo.get('name', email.split('@')[0])
        
        # Check if user exists by google_id or email
        user = db.query(User).filter(
            (User.google_id == google_id) | (User.email == email)
        ).first()
        
        if user:
            # Update google_id if not set
            if not user.google_id:
                user.google_id = google_id
                db.commit()
            
            # Check if user is active and approved
            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account is inactive"
                )
            
            if user.role in [UserRole.INTERNAL_REVIEWER.value, UserRole.EXTERNAL_REVIEWER.value]:
                if not user.is_approved:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Reviewer account pending approval"
                    )
        else:
            # Create new user
            user_role = UserRole.STUDENT
            if auth_data.role in ["internal_reviewer", "external_reviewer"]:
                user_role = UserRole(auth_data.role)
            
            needs_approval = user_role in [UserRole.INTERNAL_REVIEWER, UserRole.EXTERNAL_REVIEWER]
            
            # Generate a random password for OAuth users (they won't use it)
            import secrets
            random_password = secrets.token_urlsafe(32)
            
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=get_password_hash(random_password),
                google_id=google_id,
                role=user_role.value,
                is_approved=not needs_approval
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            if needs_approval:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Reviewer account created and pending admin approval"
                )
        
        # Create access token
        access_token = create_access_token(
            data={"sub": str(user.id), "role": user.role}
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )


# Site Settings endpoints
class SettingUpdate(BaseModel):
    value: str


@router.get("/settings/{key}")
async def get_setting(
    key: str,
    db: Session = Depends(get_db)
):
    """Get a site setting value"""
    setting = db.query(SiteSettings).filter(SiteSettings.key == key).first()
    return {"key": key, "value": setting.value if setting else None}


@router.put("/settings/{key}")
async def update_setting(
    key: str,
    data: SettingUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a site setting (admin only)"""
    setting = db.query(SiteSettings).filter(SiteSettings.key == key).first()
    if setting:
        setting.value = data.value
    else:
        setting = SiteSettings(key=key, value=data.value)
        db.add(setting)
    
    # If updating internal_reviewer_affiliation, update all internal reviewers
    if key == "internal_reviewer_affiliation":
        db.query(User).filter(
            User.role == UserRole.INTERNAL_REVIEWER.value
        ).update({"affiliation": data.value})
    
    db.commit()
    return {"key": key, "value": data.value}
