"""Shared, transaction-neutral simulated participant creation; no auth identities."""
import os
from sqlalchemy import select,func
from ..models import Caregiver,Permission,ConsentRecord,Patient
from .audit_service import record_audit
from .auth_service import get_current_account
from .demo_caregiver_service import demo_mode_enabled


def onboarding_seed_enabled():
    return demo_mode_enabled() and os.getenv("MAATRUCARE_DEMO_ONBOARDING_SEED_ENABLED", "false").lower()=="true" and os.getenv("MAATRUCARE_ENV", "local").lower() in {"local","demo","test"} and os.getenv("RENDER", "").lower()!="true"


def add_simulated_caregiver(db, *, patient_id, name, relationship, role="Support caregiver", email=None, coordination_access=False, actor_name):
	caregiver = Caregiver(
		patient_id=patient_id,
		name=name,
		relationship=relationship,
		role=role,
		is_demo=True,
		email=email,
		access_status="Active",
	)
	try:
		db.add(caregiver)
		db.flush()
		for permission_name in ("Appointments", "Coordination tasks", "Care handoffs", "Approved care updates", "Lifestyle records"):
			enabled = coordination_access and permission_name in {"Coordination tasks", "Care handoffs"}
			db.add(Permission(caregiver_id=caregiver.id, permission_name=permission_name, enabled=enabled))
			if enabled:
				db.add(ConsentRecord(patient_id=patient_id, caregiver_id=caregiver.id, permission_name=permission_name, action="granted"))
		record_audit(
			db,
			patient_id=patient_id,
			actor_name=actor_name,
			action="demo_caregiver_created",
			resource_type="Caregiver",
			resource_id=caregiver.id,
		)
	except Exception:
		raise
	return caregiver



def seed_onboarding_caregivers(db, account):
    """Only a newly created, explicitly fictional owner may reach this path."""
    if not onboarding_seed_enabled():
        return
    actor=get_current_account()
    patient=db.get(Patient,account.patient_id)
    owner=db.get(Caregiver,account.caregiver_id)
    if not actor or actor.subject!=account.subject or account.role!="patient" or not patient or not patient.is_demo_workspace or not owner or not owner.is_patient or owner.patient_id!=patient.id:
        raise ValueError("A newly created fictional owner workspace is required")
    for name,relationship in [("Ananya Rao","Partner"),("Meera Rao","Mother"),("Priya Sharma","Sister")]:
        # Do not duplicate or resurrect a participant when called again.
        exists=db.scalar(select(Caregiver.id).where(Caregiver.patient_id==patient.id,func.lower(Caregiver.name)==name.lower(),func.lower(Caregiver.relationship)==relationship.lower()))
        if exists is None:
            add_simulated_caregiver(db,patient_id=patient.id,name=name,relationship=relationship,actor_name=account.name)
