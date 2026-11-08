from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Task
from ..schemas import TaskCompletion, TaskCreate, TaskResponse, TaskUpdate
from ..services.access_service import get_active_caregiver, get_patient_member, require_patient_caregiver, require_permission
from ..services.audit_service import record_audit, record_timeline_event

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskResponse])
def list_tasks(
	actor_caregiver_id: int = Query(...),
	db: Session = Depends(get_db),
) -> list[Task]:
	actor = get_active_caregiver(db, actor_caregiver_id)
	require_permission(db, actor, "Coordination tasks")
	return list(
		db.scalars(select(Task).options(joinedload(Task.owner)).where(Task.patient_id == actor.patient_id).order_by(Task.due_date, Task.id)).all()
	)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> Task:
	actor = require_patient_caregiver(db, payload.actor_caregiver_id, payload.patient_id)
	require_permission(db, actor, "Coordination tasks")
	if payload.ai_draft_id is not None:
		from ..services.ai_draft_service import validate_task_approval
		existing = validate_task_approval(db, payload)
		if existing is not None: return existing
	if not payload.title.strip() or not payload.category.strip():
		raise HTTPException(status_code=422, detail="Task title and category are required")
	if (payload.owner_id is None) == (payload.owner_patient_id is None):
		raise HTTPException(status_code=400, detail="Provide exactly one task owner")
	if payload.owner_id is not None:
		owner = get_patient_member(db, payload.owner_id, payload.patient_id)
		require_permission(db, owner, "Coordination tasks")
	if payload.owner_patient_id is not None and payload.owner_patient_id != payload.patient_id:
		raise HTTPException(status_code=400, detail="Patient-owned tasks must belong to the task patient")
	try:
		task = Task(patient_id=payload.patient_id, title=payload.title.strip(), owner_id=payload.owner_id, owner_patient_id=payload.owner_patient_id, due_date=payload.due_date, category=payload.category.strip(), status="Open", note=payload.note, priority=payload.priority, ai_draft_id=payload.ai_draft_id, ai_suggestion_index=payload.ai_suggestion_index)
		db.add(task)
		db.flush()
		if payload.ai_draft_id is not None:
			from ..services.ai_draft_service import record_task_approval
			record_task_approval(db, payload, task, actor.name)
		record_audit(db, patient_id=payload.patient_id, actor_name=actor.name, action="task_created", resource_type="Task", resource_id=task.id)
		record_timeline_event(db, patient_id=task.patient_id, event_type="Task", title=task.title, description="A coordination task was created.", source="Coordination task")
		db.commit()
	except Exception:
		db.rollback()
		raise
	return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> Task:
	task = db.get(Task, task_id)
	if task is None:
		raise HTTPException(status_code=404, detail="Task not found")
	actor = require_patient_caregiver(db, payload.actor_caregiver_id, task.patient_id)
	require_permission(db, actor, "Coordination tasks")
	values = payload.model_dump(exclude_unset=True)
	old_status = task.status
	values.pop("actor_caregiver_id", None)
	if any(values.get(key) is None for key in ("status", "priority", "due_date", "category") if key in values):
		raise HTTPException(422, "Task status, priority, category and due date cannot be empty")
	if "category" in values and not values["category"].strip():
		raise HTTPException(422, "Task category cannot be empty")
	if "status" in values and values["status"] != task.status:
		values["completed_at"] = datetime.utcnow() if values["status"] == "Completed" else None
	if "title" in values and (values["title"] is None or not values["title"].strip()):
		raise HTTPException(status_code=422, detail="Task title cannot be empty")
	if "owner_id" in values and values["owner_id"] is not None:
		owner = get_patient_member(db, values["owner_id"], task.patient_id)
		require_permission(db, owner, "Coordination tasks")
	if "owner_patient_id" in values and values["owner_patient_id"] is not None and values["owner_patient_id"] != task.patient_id:
		raise HTTPException(status_code=400, detail="Patient-owned tasks must belong to the task patient")
	if values.get("owner_id") is not None:
	    values["owner_patient_id"] = None
	elif values.get("owner_patient_id") is not None:
	    values["owner_id"] = None
	new_owner_id = values.get("owner_id", task.owner_id)
	new_owner_patient_id = values.get("owner_patient_id", task.owner_patient_id)
	if new_owner_id is None and new_owner_patient_id is None:
		raise HTTPException(status_code=400, detail="Task must retain an owner")
	if new_owner_id is not None and new_owner_patient_id is not None:
		raise HTTPException(status_code=400, detail="Task cannot have two owners")
	for key, value in values.items():
		if key == "title" and value is not None:
			value = value.strip()
		setattr(task, key, value)
	try:
		action = "task_updated" if task.status == old_status else "task_completed" if task.status == "Completed" else "task_started" if task.status == "In progress" else "task_reopened"
		record_audit(db, patient_id=task.patient_id, actor_name=actor.name, action=action, resource_type="Task", resource_id=task.id)
		if task.status != old_status:
			record_timeline_event(db, patient_id=task.patient_id, event_type="Task", title=f"Task {task.status.lower()}", description=task.title, source="Coordination task")
		db.commit()
	except Exception:
		db.rollback()
		raise
	return task


@router.post("/{task_id}/complete", response_model=TaskResponse)
def complete_task(task_id: int, payload: TaskCompletion, db: Session = Depends(get_db)) -> Task:
	task = db.get(Task, task_id)
	if task is None:
		raise HTTPException(status_code=404, detail="Task not found")
	actor = require_patient_caregiver(db, payload.actor_caregiver_id, task.patient_id)
	require_permission(db, actor, "Coordination tasks")
	if payload.completed and task.status == "Completed":
		raise HTTPException(status_code=409, detail="Task is already completed")
	if not payload.completed and task.status != "Completed":
		raise HTTPException(status_code=409, detail="Task is already open")
	task.status = "Completed" if payload.completed else "Open"
	task.completed_at = datetime.utcnow() if payload.completed else None
	try:
		record_audit(db, patient_id=task.patient_id, actor_name=actor.name, action="task_completed" if payload.completed else "task_reopened", resource_type="Task", resource_id=task.id)
		record_timeline_event(db, patient_id=task.patient_id, event_type="Task", title=task.title, description="A coordination task was completed." if payload.completed else "A coordination task was reopened.", source="Coordination task")
		db.commit()
	except Exception:
		db.rollback()
		raise
	return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, payload: TaskCompletion, db: Session = Depends(get_db)) -> None:
	task = db.get(Task, task_id)
	if task is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
	actor = require_patient_caregiver(db, payload.actor_caregiver_id, task.patient_id)
	require_permission(db, actor, "Coordination tasks")
	try:
		record_audit(
			db,
			patient_id=task.patient_id,
			actor_name=actor.name,
			action="task_deleted",
			resource_type="Task",
			resource_id=task.id,
		)
		record_timeline_event(
			db,
			patient_id=task.patient_id,
			event_type="Task",
			title="Task removed",
			description=f'Task "{task.title}" was removed from current responsibilities.',
			source="Coordination task",
		)
		db.delete(task)
		db.commit()
	except Exception:
		db.rollback()
		raise
