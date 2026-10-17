from datetime import date

from sqlalchemy.orm import Session

from ..models import AuditLog, TimelineEvent


def record_audit(
	db: Session,
	*,
	patient_id: int,
	actor_name: str,
	action: str,
	resource_type: str = "CareHandoff",
	resource_id: int,
) -> None:
	db.add(
		AuditLog(
			patient_id=patient_id,
			actor_name=actor_name,
			action=action,
			resource_type=resource_type,
			resource_id=resource_id,
		)
	)


def record_timeline_event(
	db: Session,
	*,
	patient_id: int,
	event_type: str,
	title: str,
	description: str,
	source: str,
) -> None:
	db.add(
		TimelineEvent(
			patient_id=patient_id,
			event_type=event_type,
			title=title,
			description=description,
			event_date=date.today(),
			source=source,
		)
	)
