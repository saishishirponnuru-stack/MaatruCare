"""Idempotent, additive upgrades for SQLite and PostgreSQL. Never drops data."""
from sqlalchemy import inspect, text


def migrate_schema(engine):
    additions = {
        "accounts": {"phone": "VARCHAR(32)"},
        "caregiver_invitations": {"relationship": "VARCHAR(100) NOT NULL DEFAULT 'Family caregiver'", "withdrawn_at": "TIMESTAMP", "email_status": "VARCHAR(30) NOT NULL DEFAULT 'not_requested'", "email_accepted_at": "TIMESTAMP", "provider_message_id": "VARCHAR(255)"},
        "caregivers": {"role": "VARCHAR(100) NOT NULL DEFAULT 'Caregiver'", "is_demo": "BOOLEAN NOT NULL DEFAULT FALSE", "is_patient": "BOOLEAN NOT NULL DEFAULT FALSE"},
        "tasks": {"note": "TEXT", "priority": "VARCHAR(20) NOT NULL DEFAULT 'Normal'", "ai_draft_id": "INTEGER REFERENCES ai_drafts(id)", "ai_suggestion_index": "INTEGER"},
        "audit_logs": {"actor_account_id": "INTEGER REFERENCES accounts(id)", "actor_subject": "VARCHAR(255)", "actor_caregiver_id": "INTEGER REFERENCES caregivers(id)", "simulated": "BOOLEAN NOT NULL DEFAULT FALSE"},
        "care_handoffs": {"cancelled_at": "TIMESTAMP", "archived_at": "TIMESTAMP","sent_at": "TIMESTAMP", "completed_at": "TIMESTAMP", "context": "TEXT", "related_task_id": "INTEGER REFERENCES tasks(id) ON DELETE SET NULL", "ai_draft_id": "INTEGER REFERENCES ai_drafts(id)"},
        "timeline_events": {"actor_name": "VARCHAR(200)", "resource_type": "VARCHAR(100)", "resource_id": "INTEGER", "simulated": "BOOLEAN NOT NULL DEFAULT FALSE"},
        "lifestyle_sleep_logs": {"interruptions": "INTEGER"},
        "lifestyle_activity_logs": {"completion_status": "VARCHAR(30)", "actual_minutes": "INTEGER", "planned_minutes": "INTEGER"},
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        for table_name, columns in additions.items():
            if not inspector.has_table(table_name):
                continue
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name not in existing:
                    connection.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {column_type}'))
        connection.execute(text("UPDATE caregivers SET is_patient = TRUE WHERE id IN (SELECT caregiver_id FROM accounts WHERE role = 'patient')"))
        if inspector.has_table("audit_logs"):
            connection.execute(text("UPDATE audit_logs SET simulated = TRUE WHERE action IN ('handoff_acknowledged_simulated', 'handoff_completed_simulated')"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_task_ai_draft_suggestion ON tasks (ai_draft_id, ai_suggestion_index)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_handoff_ai_draft ON care_handoffs (ai_draft_id)"))
