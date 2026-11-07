from datetime import date

from sqlalchemy.orm import Session

from ..models import AuditLog, TimelineEvent, Caregiver, CaregiverInvitation, Permission
from .auth_service import get_current_account

HISTORY_ACTIONS = {
	"permission_granted": "Sharing access enabled", "permission_revoked": "Sharing access disabled",
	"invitation_created": "Caregiver invited", "invitation_withdrawn": "Invitation withdrawn",
	"invitation_accepted": "Caregiver joined", "caregiver_removed": "Caregiver access revoked",
	"caregiver_updated": "Caregiver details updated", "demo_caregiver_created": "Simulated participant added",
	"task_updated": "Task updated", "ai_draft_approved": "AI draft approved", "ai_draft_rejected": "AI draft rejected",
	"journey_updated": "Journey phase updated",
}


def history_description(db, action, resource_type, resource_id):
	if resource_type == "Permission":
		permission = db.get(Permission, resource_id)
		member = db.get(Caregiver, permission.caregiver_id) if permission else None
		if permission and member:
			return f"{permission.permission_name} sharing {'enabled' if action == 'permission_granted' else 'disabled'} for {member.name}."
	if resource_type in {"Caregiver", "CaregiverInvitation"}:
		member = db.get(Caregiver if resource_type == "Caregiver" else CaregiverInvitation, resource_id)
		if member:
			return f"{member.name or 'Invited caregiver'} - {member.relationship}."
	return HISTORY_ACTIONS[action]


def record_audit(
	db: Session,
	*,
	patient_id: int,
	actor_name: str,
	action: str,
	resource_type: str = "CareHandoff",
	resource_id: int,
) -> None:
	account = get_current_account()
	db.add(
		AuditLog(
			patient_id=patient_id,
			actor_name=account.name if account else actor_name,
			actor_account_id=account.id if account and account.id else None,
			actor_subject=account.subject if account else None,
			actor_caregiver_id=account.caregiver_id if account else None,
			simulated=action.endswith("_simulated"),
			action=action,
			resource_type=resource_type,
			resource_id=resource_id,
		)
	)
	if action in HISTORY_ACTIONS:
		db.add(TimelineEvent(patient_id=patient_id, event_type="Task" if resource_type == "Task" else "Care update", title=HISTORY_ACTIONS[action], description=history_description(db, action, resource_type, resource_id), event_date=date.today(), source="Sharing" if resource_type == "Permission" else "Care Circle" if resource_type in {"Caregiver", "CaregiverInvitation"} else "Coordination", actor_name=account.name if account else actor_name, resource_type=resource_type, resource_id=resource_id, simulated=action == "demo_caregiver_created"))


def record_timeline_event(
	db: Session,
	*,
	patient_id: int,
	event_type: str,
	title: str,
	description: str,
	source: str,
) -> None:
	audit = next((entry for entry in reversed(list(db.new)) if isinstance(entry, AuditLog) and entry.patient_id == patient_id), None)
	db.add(
		TimelineEvent(
			patient_id=patient_id,
			event_type=event_type,
			title=title,
			description=description,
			event_date=date.today(),
			source=source,
			actor_name=audit.actor_name if audit else None,
			resource_type=audit.resource_type if audit else None,
			resource_id=audit.resource_id if audit else None,
			simulated=bool(audit and audit.action.endswith("_simulated")),
		)
	)
