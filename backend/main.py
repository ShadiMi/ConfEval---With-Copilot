from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os

from app.config import settings
from app.database import init_db
from app.routers import auth, sessions, projects, criteria, reviews, applications, tags, notifications, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    # Startup
    init_db()
    
    # Create default admin user if not exists
    from app.database import SessionLocal
    from app.models import User, UserRole
    from app.auth import get_password_hash
    
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == UserRole.ADMIN.value).first()
        if not admin:
            admin = User(
                email="admin@confeval.com",
                full_name="System Administrator",
                hashed_password=get_password_hash("Admin123!"),
                role=UserRole.ADMIN.value,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("Default admin created: admin@confeval.com / Admin123!")
    finally:
        db.close()
    
    yield
    # Shutdown (nothing needed)


# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="A comprehensive conference/poster review system",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directory
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(criteria.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(reports.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "app": settings.APP_NAME}


@app.get("/api/stats")
async def get_stats():
    """Get system statistics"""
    from app.database import SessionLocal
    from app.models import User, Session, Project, Review
    
    db = SessionLocal()
    try:
        return {
            "total_users": db.query(User).count(),
            "total_sessions": db.query(Session).count(),
            "total_projects": db.query(Project).count(),
            "total_reviews": db.query(Review).count()
        }
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
