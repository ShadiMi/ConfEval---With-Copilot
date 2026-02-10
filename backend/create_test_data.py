#!/usr/bin/env python3
"""
Script to create test data for the ConfEval application.
Creates: 12 students, 6 internal reviewers, 6 external reviewers, 3 conferences, 9 sessions, 36 projects, reviews
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
    ReviewerApplication, ApplicationStatus, ProjectTeamInvitation
)

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
        
        # Create 12 students
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
            ("Ivy", "Taylor"),
            ("Jack", "Anderson"),
            ("Kate", "Thomas"),
            ("Leo", "Jackson"),
        ]
        
        for i, (first, last) in enumerate(student_names, 1):
            student = User(
                email=f"{TEST_PREFIX}student{i}{TEST_EMAIL_DOMAIN}",
                full_name=f"{first} {last}",
                hashed_password=hash_password("test123"),
                role=UserRole.STUDENT.value,
                is_approved=True,
                affiliation=f"University {chr(64 + (i % 26) + 1)}",
            )
            db.add(student)
            students.append(student)
        db.flush()
        print(f"  Created {len(students)} students")
        
        # Create 6 internal reviewers
        internal_reviewers = []
        internal_names = [
            ("Dr. James", "Anderson"),
            ("Dr. Sarah", "Thompson"),
            ("Dr. Michael", "Garcia"),
            ("Dr. Emily", "Martinez"),
            ("Dr. Richard", "Harris"),
            ("Dr. Amanda", "Lewis"),
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
        
        # Create 6 external reviewers
        external_reviewers = []
        external_names = [
            ("Prof. Robert", "Lee"),
            ("Prof. Jennifer", "Clark"),
            ("Prof. William", "Hall"),
            ("Prof. Lisa", "Young"),
            ("Prof. Daniel", "King"),
            ("Prof. Michelle", "Wright"),
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
        
        # Create 3 conferences
        # Building names must be in Hebrew: לגסי, אינשטיין, ספרא, מינקוף, קציר, שמעון
        conferences = []
        conference_data = [
            {
                "name": f"{TEST_PREFIX}Annual Research Conference 2026",
                "description": "Annual multi-session research conference showcasing student projects across all disciplines",
                "start_date": datetime.now() + timedelta(days=30),
                "end_date": datetime.now() + timedelta(days=33),
                "building": "ספרא",
                "floor": 1,
                "room_number": 101,
                "location": "Main Campus",
                "status": ConferenceStatus.ACTIVE.value,
                "max_sessions": 10,
            },
            {
                "name": f"{TEST_PREFIX}Tech Innovation Summit 2026",
                "description": "Technology and innovation focused conference featuring cutting-edge research",
                "start_date": datetime.now() + timedelta(days=60),
                "end_date": datetime.now() + timedelta(days=62),
                "building": "לגסי",
                "floor": 2,
                "room_number": 201,
                "location": "Innovation Hub",
                "status": ConferenceStatus.ACTIVE.value,
                "max_sessions": 8,
            },
            {
                "name": f"{TEST_PREFIX}Graduate Research Expo 2026",
                "description": "Graduate student research presentations and poster sessions",
                "start_date": datetime.now() + timedelta(days=90),
                "end_date": datetime.now() + timedelta(days=91),
                "building": "אינשטיין",
                "floor": 2,
                "room_number": 205,
                "location": "Graduate Building",
                "status": ConferenceStatus.DRAFT.value,
                "max_sessions": 6,
            },
        ]
        
        for conf_data in conference_data:
            conference = Conference(**conf_data)
            db.add(conference)
            conferences.append(conference)
        db.flush()
        print(f"  Created {len(conferences)} conferences")
        
        # Create sessions for each conference (3 sessions per conference = 9 total)
        sessions = []
        all_session_data = [
            # Conference 1 sessions
            {
                "name": f"{TEST_PREFIX}AI and Machine Learning Track",
                "description": "Presentations on artificial intelligence and machine learning research",
                "conference_id": conferences[0].id,
                "start_date": datetime.now() + timedelta(days=30),
                "end_date": datetime.now() + timedelta(days=30, hours=4),
                "location": "Room 101",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 15,
            },
            {
                "name": f"{TEST_PREFIX}Software Engineering Track",
                "description": "Software development methodologies and best practices",
                "conference_id": conferences[0].id,
                "start_date": datetime.now() + timedelta(days=31),
                "end_date": datetime.now() + timedelta(days=31, hours=4),
                "location": "Room 102",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 12,
            },
            {
                "name": f"{TEST_PREFIX}Data Analytics Track",
                "description": "Big data, analytics, and visualization projects",
                "conference_id": conferences[0].id,
                "start_date": datetime.now() + timedelta(days=32),
                "end_date": datetime.now() + timedelta(days=32, hours=4),
                "location": "Room 103",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 10,
            },
            # Conference 2 sessions
            {
                "name": f"{TEST_PREFIX}Web Technologies Workshop",
                "description": "Modern web development frameworks and technologies",
                "conference_id": conferences[1].id,
                "start_date": datetime.now() + timedelta(days=60),
                "end_date": datetime.now() + timedelta(days=60, hours=5),
                "location": "Innovation Lab A",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 12,
            },
            {
                "name": f"{TEST_PREFIX}Mobile App Showcase",
                "description": "iOS and Android application demonstrations",
                "conference_id": conferences[1].id,
                "start_date": datetime.now() + timedelta(days=61),
                "end_date": datetime.now() + timedelta(days=61, hours=5),
                "location": "Innovation Lab B",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 10,
            },
            {
                "name": f"{TEST_PREFIX}Cloud & DevOps Session",
                "description": "Cloud infrastructure and DevOps practices",
                "conference_id": conferences[1].id,
                "start_date": datetime.now() + timedelta(days=62),
                "end_date": datetime.now() + timedelta(days=62, hours=4),
                "location": "Innovation Lab C",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 8,
            },
            # Conference 3 sessions
            {
                "name": f"{TEST_PREFIX}Cybersecurity Research",
                "description": "Security research and vulnerability analysis",
                "conference_id": conferences[2].id,
                "start_date": datetime.now() + timedelta(days=90),
                "end_date": datetime.now() + timedelta(days=90, hours=4),
                "location": "Secure Lab 1",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 8,
            },
            {
                "name": f"{TEST_PREFIX}IoT and Embedded Systems",
                "description": "Internet of Things and embedded computing projects",
                "conference_id": conferences[2].id,
                "start_date": datetime.now() + timedelta(days=90, hours=5),
                "end_date": datetime.now() + timedelta(days=90, hours=9),
                "location": "Hardware Lab",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 6,
            },
            {
                "name": f"{TEST_PREFIX}Emerging Technologies",
                "description": "Blockchain, AR/VR, and other emerging tech",
                "conference_id": conferences[2].id,
                "start_date": datetime.now() + timedelta(days=91),
                "end_date": datetime.now() + timedelta(days=91, hours=4),
                "location": "Future Tech Room",
                "status": SessionStatus.UPCOMING.value,
                "max_projects": 8,
            },
        ]
        
        for i, sess_data in enumerate(all_session_data):
            session = Session(**sess_data)
            # Assign different tags to different sessions
            session.tags = [tags[i % len(tags)], tags[(i + 1) % len(tags)]]
            db.add(session)
            sessions.append(session)
        db.flush()
        print(f"  Created {len(sessions)} sessions")
        
        # Create 36 projects (4 per session, distributed among students)
        projects = []
        project_data = [
            # Session 0: AI and Machine Learning Track
            ("Neural Network Image Classification System", "A deep learning system for classifying images into multiple categories using CNN architectures.", 0),
            ("Real-time Object Detection for Autonomous Vehicles", "Implementation of YOLO-based object detection for self-driving car applications.", 0),
            ("Sentiment Analysis Using Transformer Models", "Using BERT and GPT models for analyzing social media sentiment.", 0),
            ("Predictive Maintenance with Machine Learning", "ML-based system to predict equipment failures before they occur.", 0),
            # Session 1: Software Engineering Track
            ("Microservices Architecture for E-commerce", "Scalable microservices-based backend for online shopping platform.", 1),
            ("Continuous Integration Pipeline Design", "Automated CI/CD pipeline using GitHub Actions and Docker.", 1),
            ("Test-Driven Development Framework", "Custom testing framework with coverage analysis.", 1),
            ("Code Quality Analysis Tool", "Static code analyzer for detecting bugs and code smells.", 1),
            # Session 2: Data Analytics Track
            ("Customer Churn Prediction Model", "ML model to predict customer churn using historical data.", 2),
            ("Real-time Dashboard for Sales Analytics", "Interactive dashboard with live data visualization.", 2),
            ("Social Media Trend Analysis", "Data mining tool for identifying trending topics.", 2),
            ("Healthcare Data Visualization Platform", "Visual analytics for patient health records.", 2),
            # Session 3: Web Technologies Workshop
            ("Responsive E-commerce Platform", "Full-stack e-commerce solution with modern UI/UX design.", 3),
            ("Cloud-based Collaboration Tool", "Real-time collaboration platform with video conferencing.", 3),
            ("Progressive Web App for News", "PWA with offline support and push notifications.", 3),
            ("GraphQL API Gateway", "Unified GraphQL layer for microservices.", 3),
            # Session 4: Mobile App Showcase
            ("Mobile Health Tracking Application", "Cross-platform app for tracking health metrics and fitness.", 4),
            ("Augmented Reality Shopping App", "AR-enabled mobile shopping experience.", 4),
            ("Social Networking App for Students", "Campus-focused social network with study groups.", 4),
            ("Mobile Payment Wallet", "Secure digital wallet with biometric authentication.", 4),
            # Session 5: Cloud & DevOps Session
            ("Kubernetes Cluster Management Tool", "Web-based K8s cluster monitoring and management.", 5),
            ("Serverless Application Framework", "Framework for building serverless functions.", 5),
            ("Infrastructure as Code Templates", "Terraform templates for common cloud patterns.", 5),
            ("Container Security Scanner", "Automated vulnerability scanning for Docker images.", 5),
            # Session 6: Cybersecurity Research
            ("Network Intrusion Detection System", "ML-based system for detecting network anomalies.", 6),
            ("Secure Password Manager", "Zero-knowledge encrypted password vault.", 6),
            ("Phishing Detection Browser Extension", "Browser plugin to identify phishing attempts.", 6),
            ("Blockchain-based Identity Verification", "Decentralized identity management system.", 6),
            # Session 7: IoT and Embedded Systems
            ("IoT Smart Home Automation", "Smart home system integrating various IoT devices.", 7),
            ("Wearable Health Monitor", "Embedded device for continuous health monitoring.", 7),
            ("Agricultural Sensor Network", "IoT sensors for smart farming applications.", 7),
            ("Industrial Equipment Monitoring", "Real-time monitoring of factory equipment.", 7),
            # Session 8: Emerging Technologies
            ("Blockchain-based Voting System", "Secure and transparent voting using blockchain.", 8),
            ("Virtual Reality Training Platform", "VR-based employee training simulation.", 8),
            ("Natural Language Processing Chatbot", "Conversational AI assistant for customer support.", 8),
            ("Quantum Computing Simulator", "Educational simulator for quantum algorithms.", 8),
        ]
        
        for i, (title, description, session_idx) in enumerate(project_data):
            student_index = i % len(students)
            
            project = Project(
                title=f"{TEST_PREFIX}{title}",
                description=description,
                student_id=students[student_index].id,
                session_id=sessions[session_idx].id,
                status=ProjectStatus.APPROVED.value if i < 24 else ProjectStatus.PENDING.value,
                poster_number=f"P-{i+1:02d}" if i < 24 else None,
                mentor_email=f"mentor{(i % 10) + 1}@university.edu",
            )
            # Assign tags based on session
            tag_idx = session_idx % len(tags)
            project.tags = [tags[tag_idx], tags[(tag_idx + 1) % len(tags)]]
            
            db.add(project)
            projects.append(project)
        
        db.flush()
        print(f"  Created {len(projects)} projects")
        
        # Assign reviewers to sessions (distribute evenly)
        all_reviewers = internal_reviewers + external_reviewers
        for i, session in enumerate(sessions):
            # Each session gets 4 reviewers (2 internal + 2 external, rotating)
            start_idx = (i * 2) % len(internal_reviewers)
            session.reviewers = [
                internal_reviewers[start_idx],
                internal_reviewers[(start_idx + 1) % len(internal_reviewers)],
                external_reviewers[start_idx % len(external_reviewers)],
                external_reviewers[(start_idx + 1) % len(external_reviewers)],
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
        print(f"\nSummary:")
        print(f"  - {len(conferences)} conferences")
        print(f"  - {len(sessions)} sessions")
        print(f"  - {len(projects)} projects ({len([p for p in projects if p.status == ProjectStatus.APPROVED.value])} approved)")
        print(f"  - {reviews_created} reviews")
        print(f"\nTest user credentials (password: test123):")
        print(f"  Students: {TEST_PREFIX}student1{TEST_EMAIL_DOMAIN} to {TEST_PREFIX}student{len(students)}{TEST_EMAIL_DOMAIN}")
        print(f"  Internal reviewers: {TEST_PREFIX}internal1{TEST_EMAIL_DOMAIN} to {TEST_PREFIX}internal{len(internal_reviewers)}{TEST_EMAIL_DOMAIN}")
        print(f"  External reviewers: {TEST_PREFIX}external1{TEST_EMAIL_DOMAIN} to {TEST_PREFIX}external{len(external_reviewers)}{TEST_EMAIL_DOMAIN}")
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ Error creating test data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()
