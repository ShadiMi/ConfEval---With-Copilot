#!/usr/bin/env python3
"""
Script to create test data for the ConfEval application.
Creates: 8 students, 4 internal reviewers, 4 external reviewers, 3 sessions, 12 projects, reviews
"""

import sys
sys.path.insert(0, '.')

from datetime import datetime, timedelta
import bcrypt
import random
from app.database import SessionLocal
from app.models import User, UserRole, Session, SessionStatus, Project, ProjectStatus, Tag, Review, CriteriaScore, Criteria

# Test data identifier prefix - used to identify test data for deletion
TEST_PREFIX = "test_"
TEST_EMAIL_DOMAIN = "@confeval.com"

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
        ]
        
        tags = []
        for tag_data in tags_data:
            tag = Tag(**tag_data)
            db.add(tag)
            tags.append(tag)
        db.flush()
        print(f"  Created {len(tags)} tags")
        
        # Create 8 students
        students = []
        student_names = [
            ("Alice", "Johnson"),
            ("Bob", "Smith"),
            ("Carol", "Williams"),
            ("David", "Brown"),
            ("Emma", "Davis"),
            ("Frank", "Miller"),
            ("Grace", "Wilson"),
            ("Henry", "Moore"),
        ]
        
        for i, (first, last) in enumerate(student_names, 1):
            student = User(
                email=f"{TEST_PREFIX}student{i}{TEST_EMAIL_DOMAIN}",
                full_name=f"{first} {last}",
                hashed_password=hash_password("test123"),
                role=UserRole.STUDENT.value,
                is_approved=True,
                affiliation=f"University {chr(64 + i)}",
            )
            db.add(student)
            students.append(student)
        db.flush()
        print(f"  Created {len(students)} students")
        
        # Create 4 internal reviewers
        internal_reviewers = []
        internal_names = [
            ("Dr. James", "Anderson"),
            ("Dr. Sarah", "Thompson"),
            ("Dr. Michael", "Garcia"),
            ("Dr. Emily", "Martinez"),
        ]
        
        for i, (first, last) in enumerate(internal_names, 1):
            reviewer = User(
                email=f"{TEST_PREFIX}internal{i}{TEST_EMAIL_DOMAIN}",
                full_name=f"{first} {last}",
                hashed_password=hash_password("test123"),
                role=UserRole.INTERNAL_REVIEWER.value,
                is_approved=True,
                affiliation="Main University",
            )
            db.add(reviewer)
            internal_reviewers.append(reviewer)
        db.flush()
        print(f"  Created {len(internal_reviewers)} internal reviewers")
        
        # Create 4 external reviewers
        external_reviewers = []
        external_names = [
            ("Prof. Robert", "Lee"),
            ("Prof. Jennifer", "Clark"),
            ("Prof. William", "Hall"),
            ("Prof. Lisa", "Young"),
        ]
        
        for i, (first, last) in enumerate(external_names, 1):
            reviewer = User(
                email=f"{TEST_PREFIX}external{i}{TEST_EMAIL_DOMAIN}",
                full_name=f"{first} {last}",
                hashed_password=hash_password("test123"),
                role=UserRole.EXTERNAL_REVIEWER.value,
                is_approved=True,
                affiliation=f"Partner University {chr(64 + i)}",
            )
            db.add(reviewer)
            external_reviewers.append(reviewer)
        db.flush()
        print(f"  Created {len(external_reviewers)} external reviewers")
        
        # Create 3 sessions
        sessions = []
        session_data = [
            {
                "name": f"{TEST_PREFIX}Spring 2026 Research Symposium",
                "description": "Annual spring research presentation event",
                "start_date": datetime.now() + timedelta(days=30),
                "end_date": datetime.now() + timedelta(days=32),
                "location": "Main Auditorium",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 20,
            },
            {
                "name": f"{TEST_PREFIX}Summer 2026 Tech Conference",
                "description": "Technology showcase and demo day",
                "start_date": datetime.now() + timedelta(days=60),
                "end_date": datetime.now() + timedelta(days=61),
                "location": "Innovation Center",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 15,
            },
            {
                "name": f"{TEST_PREFIX}Fall 2026 Academic Fair",
                "description": "Cross-disciplinary academic presentations",
                "start_date": datetime.now() + timedelta(days=90),
                "end_date": datetime.now() + timedelta(days=93),
                "location": "Conference Hall B",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 25,
            },
        ]
        
        for sess_data in session_data:
            session = Session(**sess_data)
            # Add tags to session
            session.tags = tags[:2]  # Add first 2 tags
            db.add(session)
            sessions.append(session)
        db.flush()
        print(f"  Created {len(sessions)} sessions")
        
        # Create 12 projects (4 per session, distributed among students)
        projects = []
        project_titles = [
            # Session 1 projects
            "Neural Network Image Classification System",
            "Real-time Object Detection for Autonomous Vehicles",
            "Sentiment Analysis Using Transformer Models",
            "Predictive Maintenance with Machine Learning",
            # Session 2 projects
            "Responsive E-commerce Platform",
            "Cloud-based Collaboration Tool",
            "Mobile Health Tracking Application",
            "Social Media Analytics Dashboard",
            # Session 3 projects
            "Blockchain-based Voting System",
            "IoT Smart Home Automation",
            "Natural Language Processing Chatbot",
            "Augmented Reality Educational App",
        ]
        
        project_descriptions = [
            "A deep learning system for classifying images into multiple categories using CNN architectures.",
            "Implementation of YOLO-based object detection for self-driving car applications.",
            "Using BERT and GPT models for analyzing social media sentiment.",
            "ML-based system to predict equipment failures before they occur.",
            "Full-stack e-commerce solution with modern UI/UX design.",
            "Real-time collaboration platform with video conferencing and document sharing.",
            "Cross-platform mobile app for tracking health metrics and fitness goals.",
            "Data visualization tool for social media performance metrics.",
            "Secure and transparent voting system using blockchain technology.",
            "Smart home system integrating various IoT devices.",
            "Conversational AI assistant for customer support.",
            "AR application for interactive educational content.",
        ]
        
        for i, (title, description) in enumerate(zip(project_titles, project_descriptions)):
            session_index = i // 4  # 4 projects per session
            student_index = i % 8   # Distribute among 8 students
            
            project = Project(
                title=f"{TEST_PREFIX}{title}",
                description=description,
                student_id=students[student_index].id,
                session_id=sessions[session_index].id,
                status=ProjectStatus.APPROVED.value if i < 8 else ProjectStatus.PENDING.value,
                poster_number=f"P-{i+1:02d}" if i < 8 else None,
                mentor_email=f"mentor{i+1}@university.edu",
            )
            # Add tags based on project type
            if "Neural" in title or "Machine" in title or "Sentiment" in title or "NLP" in title:
                project.tags = [tags[0]]  # ML tag
            elif "E-commerce" in title or "Cloud" in title or "Mobile" in title or "Dashboard" in title:
                project.tags = [tags[1]]  # Web Dev tag
            else:
                project.tags = [tags[2]]  # Data Science tag
            
            db.add(project)
            projects.append(project)
        
        db.flush()
        print(f"  Created {len(projects)} projects")
        
        # Assign some reviewers to sessions
        for session in sessions:
            session.reviewers = internal_reviewers[:2] + external_reviewers[:2]
        
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
        print(f"\nTest user credentials (password: test123):")
        print(f"  Students: {TEST_PREFIX}student1{TEST_EMAIL_DOMAIN} to {TEST_PREFIX}student8{TEST_EMAIL_DOMAIN}")
        print(f"  Internal reviewers: {TEST_PREFIX}internal1{TEST_EMAIL_DOMAIN} to {TEST_PREFIX}internal4{TEST_EMAIL_DOMAIN}")
        print(f"  External reviewers: {TEST_PREFIX}external1{TEST_EMAIL_DOMAIN} to {TEST_PREFIX}external4{TEST_EMAIL_DOMAIN}")
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ Error creating test data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()
