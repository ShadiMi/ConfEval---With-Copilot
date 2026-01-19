#!/usr/bin/env python3
"""Database migration script to add new columns"""

import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'confeval.db')
print(f"Migrating database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Add new columns to users table
columns_to_add = [
    ('id_number', 'VARCHAR(9)'),
    ('phone_number', 'VARCHAR'),
    ('google_id', 'VARCHAR'),
]

for col_name, col_type in columns_to_add:
    try:
        cursor.execute(f'ALTER TABLE users ADD COLUMN {col_name} {col_type}')
        print(f'✓ Added {col_name} column')
    except sqlite3.OperationalError as e:
        if 'duplicate column name' in str(e):
            print(f'  {col_name} column already exists')
        else:
            print(f'✗ Error adding {col_name}: {e}')

# Create site_settings table
try:
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS site_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key VARCHAR UNIQUE NOT NULL,
            value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print('✓ Created/verified site_settings table')
except sqlite3.OperationalError as e:
    print(f'✗ Error with site_settings: {e}')

# Create project_reviewers table for assigning reviewers to projects
try:
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS project_reviewers (
            project_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (project_id, user_id),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    print('✓ Created/verified project_reviewers table')
except sqlite3.OperationalError as e:
    print(f'✗ Error with project_reviewers: {e}')

# Create project_team_members table
try:
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS project_team_members (
            project_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (project_id, user_id),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    print('✓ Created/verified project_team_members table')
except sqlite3.OperationalError as e:
    print(f'✗ Error with project_team_members: {e}')

# Create project_team_invitations table
try:
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS project_team_invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            email VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            invited_by_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            responded_at TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (invited_by_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    print('✓ Created/verified project_team_invitations table')
except sqlite3.OperationalError as e:
    print(f'✗ Error with project_team_invitations: {e}')

# Add mentor_email column to projects table
try:
    cursor.execute('ALTER TABLE projects ADD COLUMN mentor_email VARCHAR(255)')
    print('✓ Added mentor_email column to projects')
except sqlite3.OperationalError as e:
    if 'duplicate column name' in str(e):
        print('  mentor_email column already exists')
    else:
        print(f'✗ Error adding mentor_email: {e}')

conn.commit()
conn.close()
print('\nMigration complete!')
