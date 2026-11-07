from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ConsentRecord, Permission
from ..schemas import ConsentRecordResponse, PermissionResponse, PermissionUpdate
from ..services.access_service import is_workspace_owner, ALLOWED_PERMISSIONS, require_patient_controller, require_patient_caregiver, get_patient_member
from ..services.audit_service import record_audit

router = APIRouter(prefix="/api/permissions", tags=["permissions"])


@router.get("/history", response_model=list[ConsentRecordResponse])
def permission_history(patient_id: int, actor_caregiver_id: int, db: Session = Depends(get_db)):
	actor = require_patient_caregiver(db, actor_caregiver_id, patient_id)
	query = select(ConsentRecord).where(ConsentRecord.patient_id == patient_id)
	if not is_workspace_owner(db, actor):
		query = query.where(ConsentRecord.caregiver_id == actor.id)
	return list(db.scalars(query.order_by(ConsentRecord.created_at.desc(), ConsentRecord.id.desc()).limit(20)).all())


@router.get("", response_model=list[PermissionResponse])
def list_permissions(
	patient_id: int = Query(...),
	actor_caregiver_id: int = Query(...),
	db: Session = Depends(get_db),
) -> list[Permission]:
	actor = require_patient_caregiver(db, actor_caregiver_id, patient_id)
	return list(
		db.scalars(
			select(Permission)
			.join(Permission.caregiver)
			.where(Permission.caregiver.has(patient_id=patient_id))
			.where(True if is_workspace_owner(db, actor) else Permission.caregiver_id == actor.id)
			.order_by(Permission.caregiver_id, Permission.id)
		).all()
	)


@router.put("", response_model=PermissionResponse)
def update_permission(payload: PermissionUpdate, db: Session = Depends(get_db)) -> Permission:
	if payload.permission_name not in ALLOWED_PERMISSIONS:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported permission")
	actor = require_patient_controller(db, payload.actor_caregiver_id, payload.patient_id)
	target = get_patient_member(db, payload.caregiver_id, payload.patient_id)
	if target.is_patient or target.id == actor.id:
		raise HTTPException(status_code=403, detail="Your own workspace access cannot be changed through caregiver sharing")
	permission_records = list(
		db.scalars(
			select(Permission).where(
				Permission.caregiver_id == target.id,
				Permission.permission_name == payload.permission_name,
			)
		).all()
	)
	if len(permission_records) > 1:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Multiple permission records exist for this caregiver and permission")
	if not permission_records:
		if not payload.enabled:
			raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Permission record does not exist to revoke")
		permission = Permission(caregiver_id=target.id, permission_name=payload.permission_name, enabled=False)
		db.add(permission)
		db.flush()
	else:
		permission = permission_records[0]
	if permission.enabled == payload.enabled:
		return permission
	try:
		permission.enabled = payload.enabled
		db.add(
			ConsentRecord(
				patient_id=payload.patient_id,
				caregiver_id=target.id,
				permission_name=payload.permission_name,
				action="granted" if payload.enabled else "revoked",
			)
		)
		record_audit(
			db,
			patient_id=payload.patient_id,
			actor_name=actor.name,
			action="permission_granted" if payload.enabled else "permission_revoked",
			resource_type="Permission",
			resource_id=permission.id,
		)
		db.commit()
	except Exception:
		db.rollback()
		raise
	return permission
