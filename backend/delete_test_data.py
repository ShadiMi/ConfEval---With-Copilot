#!/usr/bin/env python3
"""
Script to delete test data created by create_test_data.py
Removes all data with the test prefix identifier.
"""

import sys
sys.path.insert(0, '.')

from sqlalchemy import text
from app.database import SessionLocal
from app.models import (
    User, Session, Project, Tag, Review, ReviewerApplication,
    Conference, Criteria, CriteriaScore, ProjectTeamInvitation, Notification
)

# Must match the prefix used in create_test_data.py
TEST_PREFIX = "test_"
TEST_EMAIL_DOMAIN = "@confeval.com"

def delete_test_data():
    db = SessionLocal()
    
    try:
        print("Deleting test data...")
        
        # Get test IDs first
        test_projects = db.query(Project).filter(Project.title.like(f"{TEST_PREFIX}%")).all()
        project_ids = [p.id for p in test_projects]
        
        test_sessions = db.query(Session).filter(Session.name.like(f"{TEST_PREFIX}%")).all()
        session_ids = [s.id for s in test_sessions]
        
        test_users = db.query(User).filter(User.email.like(f"{TEST_PREFIX}%{TEST_EMAIL_DOMAIN}")).all()
        user_ids = [u.id for u in test_users]
        
        test_criteria = db.query(Criteria).filter(Criteria.name.like(f"{TEST_PREFIX}%")).all()
        criteria_ids = [c.id for c in test_criteria]
        
        test_tags = db.query(Tag).filter(Tag.name.like(f"{TEST_PREFIX}%")).all()
        tag_ids = [t.id for t in test_tags]
        
        test_conferences = db.query(Conference).filter(Conference.name.like(f"{TEST_PREFIX}%")).all()
        conference_ids = [c.id for c in test_conferences]
        
        # Clear association tables first
        if project_ids:
            db.execute(text(f"DELETE FROM project_tags WHERE project_id IN ({','.join(map(str, project_ids))})"))
            db.execute(text(f"DELETE FROM project_reviewers WHERE project_id IN ({','.join(map(str, project_ids))})"))
            db.execute(text(f"DELETE FROM project_team_members WHERE project_id IN ({','.join(map(str, project_ids))})"))
            print(f"  Cleared project association tables")
        
        if session_ids:
            db.execute(text(f"DELETE FROM session_reviewers WHERE session_id IN ({','.join(map(str, session_ids))})"))
            db.execute(text(f"DELETE FROM session_tags WHERE session_id IN ({','.join(map(str, session_ids))})"))
            print(f"  Cleared session association tables")
        
        if user_ids:
            db.execute(text(f"DELETE FROM reviewer_tags WHERE user_id IN ({','.join(map(str, user_ids))})"))
            print(f"  Cleared user association tables")
        
        # Delete criteria scores for test criteria
        if criteria_ids:
            scores_deleted = db.query(CriteriaScore).filter(CriteriaScore.criteria_id.in_(criteria_ids)).delete(synchronize_session=False)
            print(f"  Deleted {scores_deleted} criteria scores")
        
        # Delete reviews for test projects
        if project_ids:
            reviews_deleted = db.query(Review).filter(Review.project_id.in_(project_ids)).delete(synchronize_session=False)
            print(f"  Deleted {reviews_deleted} reviews")
        
        # Delete team invitations for test projects
        if project_ids:
            invites_deleted = db.query(ProjectTeamInvitation).filter(ProjectTeamInvitation.project_id.in_(project_ids)).delete(synchronize_session=False)
            print(f"  Deleted {invites_deleted} team invitations")
        
        # Delete test projects
        projects_deleted = db.query(Project).filter(Project.title.like(f"{TEST_PREFIX}%")).delete(synchronize_session=False)
        print(f"  Deleted {projects_deleted} projects")
        
        # Delete test criteria
        criteria_deleted = db.query(Criteria).filter(Criteria.name.like(f"{TEST_PREFIX}%")).delete(synchronize_session=False)
        print(f"  Deleted {criteria_deleted} criteria")
        
        # Delete reviewer applications for test sessions or test users
        apps_deleted = 0
        if session_ids:
            apps_deleted += db.query(ReviewerApplication).filter(ReviewerApplication.session_id.in_(session_ids)).delete(synchronize_session=False)
        if user_ids:
            apps_deleted += db.query(ReviewerApplication).filter(ReviewerApplication.reviewer_id.in_(user_ids)).delete(synchronize_session=False)
        print(f"  Deleted {apps_deleted} reviewer applications")
        
        # Delete test sessions
        sessions_deleted = db.query(Session).filter(Session.name.like(f"{TEST_PREFIX}%")).delete(synchronize_session=False)
        print(f"  Deleted {sessions_deleted} sessions")
        
        # Delete test conferences
        conferences_deleted = db.query(Conference).filter(Conference.name.like(f"{TEST_PREFIX}%")).delete(synchronize_session=False)
        print(f"  Deleted {conferences_deleted} conferences")
        
        # Delete notifications for test users
        if user_ids:
            notifs_deleted = db.query(Notification).filter(Notification.user_id.in_(user_ids)).delete(synchronize_session=False)
            print(f"  Deleted {notifs_deleted} notifications")
        
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
