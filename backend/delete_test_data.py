#!/usr/bin/env python3
"""
Script to delete test data created by create_test_data.py
Removes all data with the test prefix identifier.
"""

import sys
sys.path.insert(0, '.')

from app.database import SessionLocal
from app.models import User, Session, Project, Tag, Review, ReviewerApplication

# Must match the prefix used in create_test_data.py
TEST_PREFIX = "test_"
TEST_EMAIL_DOMAIN = "@confeval.com"

def delete_test_data():
    db = SessionLocal()
    
    try:
        print("Deleting test data...")
        
        # Delete reviews for test projects first (foreign key constraint)
        test_projects = db.query(Project).filter(Project.title.like(f"{TEST_PREFIX}%")).all()
        project_ids = [p.id for p in test_projects]
        
        if project_ids:
            reviews_deleted = db.query(Review).filter(Review.project_id.in_(project_ids)).delete(synchronize_session=False)
            print(f"  Deleted {reviews_deleted} reviews")
        
        # Delete test projects
        projects_deleted = db.query(Project).filter(Project.title.like(f"{TEST_PREFIX}%")).delete(synchronize_session=False)
        print(f"  Deleted {projects_deleted} projects")
        
        # Delete reviewer applications for test users
        test_users = db.query(User).filter(User.email.like(f"{TEST_PREFIX}%{TEST_EMAIL_DOMAIN}")).all()
        user_ids = [u.id for u in test_users]
        
        if user_ids:
            apps_deleted = db.query(ReviewerApplication).filter(ReviewerApplication.reviewer_id.in_(user_ids)).delete(synchronize_session=False)
            print(f"  Deleted {apps_deleted} reviewer applications")
        
        # Delete test sessions
        sessions_deleted = db.query(Session).filter(Session.name.like(f"{TEST_PREFIX}%")).delete(synchronize_session=False)
        print(f"  Deleted {sessions_deleted} sessions")
        
        # Delete test users
        users_deleted = db.query(User).filter(User.email.like(f"{TEST_PREFIX}%{TEST_EMAIL_DOMAIN}")).delete(synchronize_session=False)
        print(f"  Deleted {users_deleted} users")
        
        # Delete test tags
        tags_deleted = db.query(Tag).filter(Tag.name.like(f"{TEST_PREFIX}%")).delete(synchronize_session=False)
        print(f"  Deleted {tags_deleted} tags")
        
        db.commit()
        
        print("\n✓ Test data deleted successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ Error deleting test data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    # Confirmation prompt
    print("=" * 50)
    print("WARNING: This will delete all test data!")
    print("=" * 50)
    response = input("\nAre you sure you want to continue? (yes/no): ")
    
    if response.lower() == "yes":
        delete_test_data()
    else:
        print("Aborted.")
