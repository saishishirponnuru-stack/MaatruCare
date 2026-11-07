from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, and_, not_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TimelineEvent, CareHandoff
from ..schemas import TimelineEventResponse
from ..services.access_service import effective_permissions, get_active_caregiver, is_workspace_owner, require_permission

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("", response_model=list[TimelineEventResponse])
def list_timeline_events(
	actor_caregiver_id: int = Query(...),
	limit: int = Query(15, ge=1, le=100),
	offset: int = Query(0, ge=0),
	order: Literal["newest", "oldest"] = "newest",
	category: Literal["All", "Tasks", "Handoffs", "Care Circle", "Sharing changes", "Appointments"] = "All",
	db: Session = Depends(get_db),
) -> list[TimelineEvent]:
	actor = get_active_caregiver(db, actor_caregiver_id)
	require_permission(db, actor, "Approved care updates")
	allowed = effective_permissions(db, actor)
	filters = [TimelineEvent.event_type == "Care update"]
	if "Coordination tasks" in allowed: filters.append(TimelineEvent.event_type == "Task")
	if "Appointments" in allowed: filters.append(TimelineEvent.event_type == "Appointment")
	if "Care handoffs" in allowed: filters.append(and_(TimelineEvent.event_type == "Coordination", TimelineEvent.source == "Care handoff"))
	if {"Care handoffs", "Coordination tasks"}.issubset(allowed): filters.append(TimelineEvent.event_type == "Coordination")
	category_filters = {
		"Tasks": TimelineEvent.event_type == "Task",
		"Handoffs": or_(TimelineEvent.resource_type == "CareHandoff", TimelineEvent.source == "Care handoff"),
		"Care Circle": or_(TimelineEvent.resource_type.in_(["Caregiver", "CaregiverInvitation"]), TimelineEvent.source == "Care Circle"),
		"Sharing changes": or_(TimelineEvent.resource_type == "Permission", TimelineEvent.source == "Sharing"),
		"Appointments": TimelineEvent.event_type == "Appointment",
	}
	query = select(TimelineEvent).where(TimelineEvent.patient_id == actor.patient_id, or_(*filters))
	if not is_workspace_owner(db, actor):
		# Sharing a category does not make someone a participant in every handoff.
		participating = select(CareHandoff.id).where(CareHandoff.patient_id == actor.patient_id, or_(CareHandoff.from_caregiver_id == actor.id, CareHandoff.to_caregiver_id == actor.id))
		handoff_event = or_(func.coalesce(TimelineEvent.resource_type, "") == "CareHandoff", func.coalesce(TimelineEvent.source, "") == "Care handoff")
		query = query.where(or_(not_(handoff_event), and_(TimelineEvent.resource_type == "CareHandoff", TimelineEvent.resource_id.in_(participating))))
		query = query.where(or_(TimelineEvent.resource_type.is_(None), TimelineEvent.resource_type.not_in(["Caregiver", "CaregiverInvitation", "Permission"])))
	if category != "All":
		query = query.where(category_filters[category])
	ordering = (TimelineEvent.created_at.asc(), TimelineEvent.id.asc()) if order == "oldest" else (TimelineEvent.created_at.desc(), TimelineEvent.id.desc())
	return list(db.scalars(query.order_by(*ordering).offset(offset).limit(limit)).all())
