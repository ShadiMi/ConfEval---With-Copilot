#!/usr/bin/env python3
"""Database migration script (PostgreSQL).

Run inside the backend container:
    docker exec -it confeval-backend-dev python migrate.py

Reads DATABASE_URL from the app's engine. Each statement runs in its own
transaction so a failure on one step does not abort the others (PostgreSQL
aborts the whole transaction on the first error, unlike SQLite).
"""

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine


def run(sql: str, success_msg: str, *, skip_msg: str | None = None) -> None:
    """Run a single SQL statement in its own transaction."""
    try:
        with engine.begin() as conn:
            conn.execute(text(sql))
        print(f"✓ {success_msg}")
    except SQLAlchemyError as e:
        msg = str(getattr(e, "orig", e))
        lowered = msg.lower()
        if skip_msg and ("already exists" in lowered or "duplicate column" in lowered):
            print(f"  {skip_msg}")
        else:
            print(f"✗ Error ({success_msg}): {msg}")


def column_exists(table: str, column: str) -> bool:
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_name = :t AND column_name = :c
                """
            ),
            {"t": table, "c": column},
        )
        return result.first() is not None


print(f"Migrating database: {engine.url.render_as_string(hide_password=True)}")

# --- users: add new columns --------------------------------------------------
user_columns = [
    ("id_number", "VARCHAR(9)"),
    ("phone_number", "VARCHAR"),
    ("google_id", "VARCHAR"),
]
for col_name, col_type in user_columns:
    run(
        f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type}",
        f"Added users.{col_name} column",
        skip_msg=f"users.{col_name} column already exists",
    )

# --- site_settings table -----------------------------------------------------
run(
    """
    CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR UNIQUE NOT NULL,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "Created/verified site_settings table",
)

# --- project_reviewers join table -------------------------------------------
run(
    """
    CREATE TABLE IF NOT EXISTS project_reviewers (
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        PRIMARY KEY (project_id, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    "Created/verified project_reviewers table",
)

# --- project_team_members join table ----------------------------------------
run(
    """
    CREATE TABLE IF NOT EXISTS project_team_members (
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        PRIMARY KEY (project_id, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    "Created/verified project_team_members table",
)

# --- project_team_invitations table -----------------------------------------
run(
    """
    CREATE TABLE IF NOT EXISTS project_team_invitations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        email VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        invited_by_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    "Created/verified project_team_invitations table",
)

# --- projects: advisor_email (renamed from mentor_email) --------------------
if column_exists("projects", "advisor_email"):
    print("  projects.advisor_email column already exists")
elif column_exists("projects", "mentor_email"):
    run(
        "ALTER TABLE projects RENAME COLUMN mentor_email TO advisor_email",
        "Renamed projects.mentor_email -> advisor_email",
    )
else:
    run(
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS advisor_email VARCHAR(255)",
        "Added projects.advisor_email column",
        skip_msg="projects.advisor_email column already exists",
    )

# --- conferences table -------------------------------------------------------
run(
    """
    CREATE TABLE IF NOT EXISTS conferences (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'draft',
        max_sessions INTEGER DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    )
    """,
    "Created/verified conferences table",
)

# --- conferences: building / floor / room_number ----------------------------
conference_columns = [
    ("building", "VARCHAR(50)"),
    ("floor", "INTEGER"),
    ("room_number", "INTEGER"),
]
for col_name, col_type in conference_columns:
    run(
        f"ALTER TABLE conferences ADD COLUMN IF NOT EXISTS {col_name} {col_type}",
        f"Added conferences.{col_name} column",
        skip_msg=f"conferences.{col_name} column already exists",
    )

# --- sessions: conference_id FK ---------------------------------------------
run(
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS conference_id INTEGER "
    "REFERENCES conferences(id) ON DELETE SET NULL",
    "Added sessions.conference_id column",
    skip_msg="sessions.conference_id column already exists",
)

print("\nMigration complete!")
