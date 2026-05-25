#!/usr/bin/env python3
"""
Script to create test data for the ConfEval application.
Creates: 112 students, 13 internal reviewers (Excel staff),
         3 unapproved reviewers, 1 conference, 6 sessions (A–F),
         56 projects, reviews — all sourced from projects_clean.xlsx.
"""

import sys
sys.path.insert(0, '.')

from datetime import datetime, timedelta
import bcrypt
import random
from app.database import SessionLocal
from app.models import (
    User, UserRole, Session, SessionStatus, Project, ProjectStatus, 
    Tag, Review, CriteriaScore, Criteria, Conference, ConferenceStatus,
)
from test_data_excel import STAFF, STUDENTS, PROJECTS

# Test data identifier prefix - used to identify test data for deletion
TEST_PREFIX = "test_"
TEST_EMAIL_DOMAIN = "@confeval.com"

def _email_for(local: str) -> str:
    """Build a test email from an email_local string."""
    return f"{TEST_PREFIX}{local}{TEST_EMAIL_DOMAIN}"

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_test_data():
    db = SessionLocal()
    
    try:
        print("Creating test data...")
        
        # Create tags first
        tags_data = [
            {"name": f"{TEST_PREFIX}Machine Learning", "description": "ML and AI projects"},
            {"name": f"{TEST_PREFIX}Web Development", "description": "Web apps and services"},
            {"name": f"{TEST_PREFIX}Data Science", "description": "Data analysis and visualization"},
            {"name": f"{TEST_PREFIX}Cybersecurity", "description": "Security research"},
            {"name": f"{TEST_PREFIX}Mobile Development", "description": "iOS and Android apps"},
            {"name": f"{TEST_PREFIX}Cloud Computing", "description": "Cloud infrastructure and services"},
        ]
        
        tags = []
        for tag_data in tags_data:
            tag = Tag(**tag_data)
            db.add(tag)
            tags.append(tag)
        db.flush()
        print(f"  Created {len(tags)} tags")
        
        # Create students from the Excel sheet (unique persons across all projects).
        students = []
        students_by_hname = {}
        for s in STUDENTS:
            user = User(
                email=_email_for(s["email_local"]),
                # Keep the original Hebrew name as the displayed name; the English
                # transliteration in `full_name` exists only to build `email_local`.
                full_name=s["hebrew_name"] or s["full_name"],
                hashed_password=hash_password("test123"),
                role=UserRole.STUDENT.value,
                is_approved=True,
                affiliation="SCE - Shamoon College of Engineering",
            )
            db.add(user)
            students.append(user)
            students_by_hname[s["hebrew_name"]] = user
        db.flush()
        print(f"  Created {len(students)} students")
        
        # Create internal reviewers from the Excel staff list (advisors + supervisors).
        internal_reviewers = []
        staff_by_local = {}
        for s in STAFF:
            reviewer = User(
                email=_email_for(s["email_local"]),
                # Keep the original Hebrew name as the displayed name; the English
                # transliteration in `full_name` exists only to build `email_local`.
                full_name=s.get("hebrew_name") or s["full_name"],
                hashed_password=hash_password("test123"),
                role=UserRole.INTERNAL_REVIEWER.value,
                is_approved=True,
                affiliation="SCE - Shamoon College of Engineering",
            )
            db.add(reviewer)
            internal_reviewers.append(reviewer)
            staff_by_local[s["email_local"]] = reviewer
        db.flush()
        print(f"  Created {len(internal_reviewers)} internal reviewers (Excel staff)")

        # No external reviewers in this dataset.
        external_reviewers = []
        
        # Create 3 unapproved reviewers (pending admin approval)
        unapproved_reviewers = []
        unapproved_names = [
            ("Dr. Nathan", "Brooks", UserRole.INTERNAL_REVIEWER),
            ("Prof. Olivia", "Santos", UserRole.EXTERNAL_REVIEWER),
            ("Dr. Kevin", "Chen", UserRole.INTERNAL_REVIEWER),
        ]
        
        for i, (first, last, role) in enumerate(unapproved_names, 1):
            reviewer = User(
                email=f"{TEST_PREFIX}unapproved{i}{TEST_EMAIL_DOMAIN}",
                full_name=f"{first} {last}",
                hashed_password=hash_password("test123"),
                role=role.value,
                is_approved=False,
                affiliation="Pending University" if role == UserRole.INTERNAL_REVIEWER else f"External Org {chr(64 + i)}",
            )
            db.add(reviewer)
            unapproved_reviewers.append(reviewer)
        db.flush()
        print(f"  Created {len(unapproved_reviewers)} unapproved reviewers")
        
        # Create 1 conference with 6 sessions (A..F) matching the Excel sheet.
        conferences = []
        conference_data = [
            {
                "name": f"{TEST_PREFIX}SCE Final Project Conference 2026",
                "description": "Final-project conference, 6 sessions (A–F) with up to 10 screens each.",
                "start_date": datetime(2026, 6, 1, 8, 0),
                "end_date": datetime(2026, 6, 6, 20, 0),
                "building": "ספרא",
                "floor": 1,
                "room_number": 103,
                "location": "ספרא, קומה 1, חדר 103",
                "status": ConferenceStatus.ACTIVE.value,
                "max_sessions": 6,
            },
        ]
        
        for conf_data in conference_data:
            conference = Conference(**conf_data)
            db.add(conference)
            conferences.append(conference)
        db.flush()
        print(f"  Created {len(conferences)} conferences")
        
        # Create 6 sessions (one per letter A..F), each holding up to 10 screens.
        session_letters = ["A", "B", "C", "D", "E", "F"]
        sessions = []
        sessions_by_letter = {}
        for i, letter in enumerate(session_letters):
            day = 1 + i  # June 1..June 6
            sess = Session(
                name=f"{TEST_PREFIX}Session {letter}",
                description=f"Session {letter} - 10 screens of project presentations",
                conference_id=conferences[0].id,
                start_date=datetime(2026, 6, day, 9, 0),
                end_date=datetime(2026, 6, day, 17, 0),
                location="ספרא, קומה 1, חדר 103",
                status=SessionStatus.UPCOMING.value,
                max_projects=12,
            )
            sess.tags = [tags[i % len(tags)], tags[(i + 1) % len(tags)]]
            db.add(sess)
            sessions.append(sess)
            sessions_by_letter[letter] = sess
        db.flush()
        print(f"  Created {len(sessions)} sessions")
        
        # Create projects from the Excel sheet.
        projects = []
        skipped = []
        for p in PROJECTS:
            session = sessions_by_letter.get(p["session_letter"])
            if session is None:
                skipped.append((p["project_num"], "unknown session"))
                continue
            students_he = p["students_he"] or []
            if not students_he:
                skipped.append((p["project_num"], "no students"))
                continue
            owner = students_by_hname.get(students_he[0])
            if owner is None:
                skipped.append((p["project_num"], f"missing owner {students_he[0]}"))
                continue
            team_members = [
                students_by_hname[s] for s in students_he[1:]
                if s in students_by_hname
            ]

            advisor_email = _email_for(p["advisor_key"]) if p["advisor_key"] else None
            sup1_email = _email_for(p["supervisor1_key"]) if p["supervisor1_key"] else None
            sup2_email = _email_for(p["supervisor2_key"]) if p["supervisor2_key"] else None

            raw_title = p["title"] or f"Project {p['project_num']}"
            project = Project(
                title=f"{TEST_PREFIX}{raw_title}",
                description=p["title"] or "",
                student_id=owner.id,
                session_id=session.id,
                status=ProjectStatus.APPROVED.value,
                poster_number=p["poster_number"],
                advisor_email=advisor_email,
                supervisor1_email=sup1_email,
                supervisor2_email=sup2_email,
                team_members=team_members,
                tags=[],
            )
            # Assign tags based on session
            session_idx = session_letters.index(p["session_letter"])
            tag_idx = session_idx % len(tags)
            project.tags = [tags[tag_idx], tags[(tag_idx + 1) % len(tags)]]
            
            db.add(project)
            projects.append(project)
        
        db.flush()
        print(f"  Created {len(projects)} projects from Excel"
              + (f" (skipped {len(skipped)}: {skipped})" if skipped else ""))
        
        # Assign reviewers to sessions (distribute evenly).
        # All staff are internal reviewers (no external reviewers in the Excel sheet).
        all_reviewers = internal_reviewers + external_reviewers
        n_internal = len(internal_reviewers)
        for i, session in enumerate(sessions):
            # Each session gets 4 reviewers rotating through the internal pool.
            start_idx = (i * 2) % n_internal
            session.reviewers = [
                internal_reviewers[(start_idx + k) % n_internal]
                for k in range(4)
            ]
        
        db.flush()
        
        # Create criteria for each session
        criteria_list = []
        for session in sessions:
            c1 = Criteria(
                session_id=session.id,
                name=f"{TEST_PREFIX}Technical Quality",
                description="Evaluate the technical soundness and methodology",
                max_score=10,
                weight=1.0,
                order=1
            )
            c2 = Criteria(
                session_id=session.id,
                name=f"{TEST_PREFIX}Innovation",
                description="Novelty and originality of the approach",
                max_score=10,
                weight=1.0,
                order=2
            )
            c3 = Criteria(
                session_id=session.id,
                name=f"{TEST_PREFIX}Presentation",
                description="Clarity and quality of presentation",
                max_score=10,
                weight=0.5,
                order=3
            )
            db.add_all([c1, c2, c3])
            criteria_list.extend([c1, c2, c3])
        
        db.flush()
        print(f"  Created {len(criteria_list)} criteria")
        
        # Create reviews for approved projects
        reviews_created = 0
        approved_projects = [p for p in projects if p.status == ProjectStatus.APPROVED.value]
        all_reviewers = internal_reviewers + external_reviewers
        
        comments = [
            "Excellent work! The methodology is sound and well-documented.",
            "Good project overall. Some minor improvements could be made in the analysis section.",
            "Interesting approach to the problem. The results are promising.",
            "Well-structured project with clear objectives. Consider expanding the literature review.",
            "Strong technical implementation. The conclusions are well-supported by the data.",
        ]
        
        for project in approved_projects:
            # Each approved project gets 2-3 reviews
            num_reviews = random.randint(2, 3)
            project_reviewers = random.sample(all_reviewers, num_reviews)
            
            # Get criteria for this project's session
            session_criteria = [c for c in criteria_list if c.session_id == project.session_id]
            
            for reviewer in project_reviewers:
                # Assign reviewer to project
                if reviewer not in project.assigned_reviewers:
                    project.assigned_reviewers.append(reviewer)
                
                # Create review
                review = Review(
                    project_id=project.id,
                    reviewer_id=reviewer.id,
                    comments=random.choice(comments),
                    is_completed=True,
                )
                db.add(review)
                db.flush()
                
                # Create criteria scores and calculate normalized total score
                total_weighted_score = 0
                total_weight = 0
                for criteria in session_criteria:
                    score = random.randint(6, 10)
                    cs = CriteriaScore(
                        review_id=review.id,
                        criteria_id=criteria.id,
                        score=score
                    )
                    db.add(cs)
                    # Normalize score and apply weight (same as reviews.py)
                    normalized = score / criteria.max_score
                    total_weighted_score += normalized * criteria.weight
                    total_weight += criteria.weight
                
                # Calculate total score as percentage (0-100)
                review.total_score = (total_weighted_score / total_weight) * 100 if total_weight > 0 else 0
                reviews_created += 1
        
        db.commit()
        print(f"  Created {reviews_created} reviews")
        
        print("\n✓ Test data created successfully!")
        print("\nSummary:")
        print(f"  - {len(conferences)} conferences")
        print(f"  - {len(sessions)} sessions")
        print(f"  - {len(projects)} projects ({len([p for p in projects if p.status == ProjectStatus.APPROVED.value])} approved)")
        print(f"  - {reviews_created} reviews")
        print(f"  - {len(unapproved_reviewers)} unapproved reviewers")
        print("\nTest user credentials (password: test123):")
        print(f"  Students: {len(students)} from Excel sheet ({TEST_PREFIX}<transliterated-name>{TEST_EMAIL_DOMAIN})")
        print(f"  Internal reviewers (staff): {len(internal_reviewers)} from Excel sheet")
        print(f"    e.g. {TEST_PREFIX}{STAFF[0]['email_local']}{TEST_EMAIL_DOMAIN}, {TEST_PREFIX}{STAFF[1]['email_local']}{TEST_EMAIL_DOMAIN}, ...")
        print(f"  Unapproved reviewers: {TEST_PREFIX}unapproved1{TEST_EMAIL_DOMAIN} to {TEST_PREFIX}unapproved{len(unapproved_reviewers)}{TEST_EMAIL_DOMAIN}")
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ Error creating test data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()
