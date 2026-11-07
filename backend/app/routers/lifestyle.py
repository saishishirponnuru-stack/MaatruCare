import os
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..lifestyle_models import ActivityLog, ActivityRoutine, DietAdherence, DietRecommendation, LifestylePreference, NutritionLog, SleepLog, WaterLog, WeightEntry
from ..lifestyle_schemas import ActivityLogCreate, ActivityRoutineCreate, DietAdherenceCreate, DietRecommendationCreate, LifestylePreferenceUpdate, LifestyleResetRequest, LifestyleResetResponse, LifestyleResponse, NutritionCreate, SleepCreate, WaterCreate, WeightCreate
from ..models import Patient
from ..services.access_service import is_workspace_owner, require_patient_caregiver, require_permission

router = APIRouter(prefix="/api/lifestyle", tags=["lifestyle"])
LIFESTYLE_PERMISSION = "Lifestyle records"


def access(db: Session, actor_id: int, patient_id: int, write: bool = False):
    caregiver = require_patient_caregiver(db, actor_id, patient_id)
    if write:
        if not is_workspace_owner(db, caregiver):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the Care Circle owner can change lifestyle records")
    elif not is_workspace_owner(db, caregiver):
        require_permission(db, caregiver, LIFESTYLE_PERMISSION)
    return caregiver


def patient_exists(db: Session, patient_id: int) -> None:
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="Care workspace not found")


def sleep_duration_hours(bedtime, wake_time) -> float | None:
    if bedtime is None or wake_time is None:
        return None
    start = bedtime.hour * 60 + bedtime.minute
    end = wake_time.hour * 60 + wake_time.minute
    minutes = (end - start) % (24 * 60)
    return round(minutes / 60, 2)


@router.get("", response_model=LifestyleResponse)
def get_lifestyle(patient_id: int = Query(...), actor_caregiver_id: int = Query(...), db: Session = Depends(get_db)):
    patient_exists(db, patient_id)
    access(db, actor_caregiver_id, patient_id)
    routines = db.scalars(select(ActivityRoutine).where(ActivityRoutine.patient_id == patient_id).order_by(ActivityRoutine.created_at.desc())).all()
    recommendations = db.scalars(select(DietRecommendation).where(DietRecommendation.patient_id == patient_id).order_by(DietRecommendation.created_at.desc())).all()
    preference = db.scalar(select(LifestylePreference).where(LifestylePreference.patient_id == patient_id))
    if preference is None:
        preference = LifestylePreference(patient_id=patient_id)
        db.add(preference)
        db.commit()
        db.refresh(preference)
    routine_ids = [item.id for item in routines]
    recommendation_ids = [item.id for item in recommendations]
    return {
        "nutrition": db.scalars(select(NutritionLog).where(NutritionLog.patient_id == patient_id).order_by(NutritionLog.log_date.desc(), NutritionLog.id.desc())).all(),
        "water": db.scalars(select(WaterLog).where(WaterLog.patient_id == patient_id).order_by(WaterLog.log_date.desc(), WaterLog.created_at.desc())).all(),
        "sleep": db.scalars(select(SleepLog).where(SleepLog.patient_id == patient_id).order_by(SleepLog.log_date.desc(), SleepLog.created_at.desc())).all(),
        "weight": db.scalars(select(WeightEntry).where(WeightEntry.patient_id == patient_id).order_by(WeightEntry.entry_date.desc(), WeightEntry.created_at.desc())).all(),
        "diet_recommendations": recommendations,
        "diet_adherence": db.scalars(select(DietAdherence).where(DietAdherence.recommendation_id.in_(recommendation_ids))).all() if recommendation_ids else [],
        "routines": routines,
        "activity_logs": db.scalars(select(ActivityLog).where(ActivityLog.id.in_(select(func.max(ActivityLog.id)).where(ActivityLog.routine_id.in_(routine_ids)).group_by(ActivityLog.routine_id, ActivityLog.log_date))).order_by(ActivityLog.log_date.desc(), ActivityLog.id.desc())).all() if routine_ids else [],
        "preferences": preference,
    }


def save(db: Session, record):
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def reset_enabled(patient_id: int) -> bool:
    allowed = os.getenv("MAATRUCARE_DEMO_RESET_PATIENT_IDS", "").split(",")
    return (
        os.getenv("MAATRUCARE_DEMO_RESET_ENABLED", "false").lower() == "true"
        and os.getenv("MAATRUCARE_ENV", "").lower() in {"local", "demo"}
        and os.getenv("RENDER", "").lower() != "true"
        and str(patient_id) in {value.strip() for value in allowed}
    )


def reset_counts(db: Session, patient_id: int, reset_preferences: bool) -> dict[str, int]:
    counts = {
        "water": db.query(WaterLog).filter_by(patient_id=patient_id).count(),
        "sleep": db.query(SleepLog).filter_by(patient_id=patient_id).count(),
        "weight": db.query(WeightEntry).filter_by(patient_id=patient_id).count(),
        "nutrition": db.query(NutritionLog).filter_by(patient_id=patient_id).count(),
        "diet_adherence": db.query(DietAdherence).join(DietRecommendation, DietAdherence.recommendation_id == DietRecommendation.id).filter(DietRecommendation.patient_id == patient_id).count(),
        "activity_logs": db.query(ActivityLog).join(ActivityRoutine, ActivityLog.routine_id == ActivityRoutine.id).filter(ActivityRoutine.patient_id == patient_id).count(),
    }
    if reset_preferences:
        counts["preferences"] = db.query(LifestylePreference).filter_by(patient_id=patient_id).count()
    return counts


@router.get("/reset-preview")
def preview_reset(patient_id: int, actor_caregiver_id: int, reset_preferences: bool = False, db: Session = Depends(get_db)):
    access(db, actor_caregiver_id, patient_id, True)
    enabled = reset_enabled(patient_id)
    return {"enabled": enabled, "counts": reset_counts(db, patient_id, reset_preferences) if enabled else {}, "explanation": "Reset is restricted to explicitly configured local demonstration workspaces. Your records are preserved." if not enabled else "Only the listed lifestyle records in your demo workspace will be deleted. Plans, routines, care records, and authentication accounts are preserved."}


@router.post("/reset", response_model=LifestyleResetResponse)
def reset_lifestyle(payload: LifestyleResetRequest, db: Session = Depends(get_db)):
    if not reset_enabled(payload.patient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Demo reset is disabled")
    access(db, payload.actor_caregiver_id, payload.patient_id, True)
    if not payload.confirmed or payload.expected_counts != reset_counts(db, payload.patient_id, payload.reset_preferences):
        raise HTTPException(409, "Review the current deletion preview and confirm before resetting")
    routines = db.scalars(select(ActivityRoutine).where(ActivityRoutine.patient_id == payload.patient_id)).all()
    recommendations = db.scalars(select(DietRecommendation).where(DietRecommendation.patient_id == payload.patient_id)).all()
    routine_ids = [routine.id for routine in routines]
    recommendation_ids = [recommendation.id for recommendation in recommendations]
    try:
        counts = {
            "nutrition": db.query(NutritionLog).filter(NutritionLog.patient_id == payload.patient_id).delete(synchronize_session=False),
            "water": db.query(WaterLog).filter(WaterLog.patient_id == payload.patient_id).delete(synchronize_session=False),
            "sleep": db.query(SleepLog).filter(SleepLog.patient_id == payload.patient_id).delete(synchronize_session=False),
            "weight": db.query(WeightEntry).filter(WeightEntry.patient_id == payload.patient_id).delete(synchronize_session=False),
            "diet_adherence": db.query(DietAdherence).filter(DietAdherence.recommendation_id.in_(recommendation_ids)).delete(synchronize_session=False) if recommendation_ids else 0,
            "activity_logs": db.query(ActivityLog).filter(ActivityLog.routine_id.in_(routine_ids)).delete(synchronize_session=False) if routine_ids else 0,
        }
        if payload.reset_preferences:
            counts["preferences"] = db.query(LifestylePreference).filter(LifestylePreference.patient_id == payload.patient_id).delete(synchronize_session=False)
        db.commit()
        return {"deleted": counts, "preferences_reset": payload.reset_preferences}
    except Exception:
        db.rollback()
        raise


@router.post("/water")
def create_water(payload: WaterCreate, db: Session = Depends(get_db)):
    access(db, payload.actor_caregiver_id, payload.patient_id, True)
    return save(db, WaterLog(**payload.model_dump(exclude={"actor_caregiver_id"})))


@router.put("/water/{record_id}")
def update_water(record_id: int, payload: WaterCreate, db: Session = Depends(get_db)):
    record = db.get(WaterLog, record_id)
    if not record:
        raise HTTPException(404, "Water record not found")
    access(db, payload.actor_caregiver_id, record.patient_id, True)
    for key, value in payload.model_dump(exclude={"actor_caregiver_id", "patient_id"}).items():
        setattr(record, key, value)
    return save(db, record)


@router.delete("/water/{record_id}")
def delete_water(record_id: int, actor_caregiver_id: int = Query(...), db: Session = Depends(get_db)):
    record = db.get(WaterLog, record_id)
    if not record:
        raise HTTPException(404, "Water record not found")
    access(db, actor_caregiver_id, record.patient_id, True)
    db.delete(record)
    db.commit()
    return {"deleted": True}


def delete_lifestyle_record(record, actor_caregiver_id: int, db: Session):
    if record is None:
        raise HTTPException(404, "Lifestyle record not found")
    access(db, actor_caregiver_id, record.patient_id, True)
    try:
        db.delete(record)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"deleted": True}


@router.delete("/sleep/{record_id}")
def delete_sleep(record_id: int, actor_caregiver_id: int = Query(...), db: Session = Depends(get_db)):
    return delete_lifestyle_record(db.get(SleepLog, record_id), actor_caregiver_id, db)


@router.post("/sleep")
def create_sleep(payload: SleepCreate, db: Session = Depends(get_db)):
    access(db, payload.actor_caregiver_id, payload.patient_id, True)
    values = payload.model_dump(exclude={"actor_caregiver_id"})
    values["duration_hours"] = sleep_duration_hours(payload.bedtime, payload.wake_time) or values.get("duration_hours")
    existing = db.scalar(select(SleepLog).where(SleepLog.patient_id == payload.patient_id, SleepLog.log_date == payload.log_date, SleepLog.bedtime == payload.bedtime, SleepLog.wake_time == payload.wake_time, SleepLog.duration_hours == values["duration_hours"]).order_by(SleepLog.id.desc()))
    if existing:
        for key, value in values.items(): setattr(existing, key, value)
        return save(db, existing)
    return save(db, SleepLog(**values))


@router.put("/sleep/{record_id}")
def update_sleep(record_id: int, payload: SleepCreate, db: Session = Depends(get_db)):
    record = db.get(SleepLog, record_id)
    if not record:
        raise HTTPException(404, "Sleep record not found")
    access(db, payload.actor_caregiver_id, record.patient_id, True)
    for key, value in payload.model_dump(exclude={"actor_caregiver_id", "patient_id"}).items():
        setattr(record, key, value)
    record.duration_hours = sleep_duration_hours(payload.bedtime, payload.wake_time) or payload.duration_hours
    return save(db, record)


@router.post("/diet/recommendations")
def create_recommendation(payload: DietRecommendationCreate, db: Session = Depends(get_db)):
    access(db, payload.actor_caregiver_id, payload.patient_id, True)
    return save(db, DietRecommendation(**payload.model_dump(exclude={"actor_caregiver_id"})))


@router.put("/diet/recommendations/{record_id}")
def update_recommendation(record_id: int, payload: DietRecommendationCreate, db: Session = Depends(get_db)):
    record = db.get(DietRecommendation, record_id)
    if not record:
        raise HTTPException(404, "Diet recommendation not found")
    access(db, payload.actor_caregiver_id, record.patient_id, True)
    for key, value in payload.model_dump(exclude={"actor_caregiver_id", "patient_id"}).items():
        setattr(record, key, value)
    return save(db, record)


@router.post("/diet/recommendations/{recommendation_id}/adherence")
def create_adherence(recommendation_id: int, payload: DietAdherenceCreate, db: Session = Depends(get_db)):
    recommendation = db.get(DietRecommendation, recommendation_id)
    if not recommendation:
        raise HTTPException(404, "Diet recommendation not found")
    access(db, payload.actor_caregiver_id, recommendation.patient_id, True)
    return save(db, DietAdherence(recommendation_id=recommendation_id, **payload.model_dump(exclude={"actor_caregiver_id"})))


@router.put("/diet/adherence/{record_id}")
def update_adherence(record_id: int, payload: DietAdherenceCreate, db: Session = Depends(get_db)):
    record = db.get(DietAdherence, record_id)
    if not record:
        raise HTTPException(404, "Diet adherence record not found")
    recommendation = db.get(DietRecommendation, record.recommendation_id)
    if not recommendation:
        raise HTTPException(404, "Diet recommendation not found")
    access(db, payload.actor_caregiver_id, recommendation.patient_id, True)
    for key, value in payload.model_dump(exclude={"actor_caregiver_id"}).items():
        setattr(record, key, value)
    return save(db, record)


@router.delete("/diet/adherence/{record_id}")
def delete_adherence(record_id: int, actor_caregiver_id: int = Query(...), db: Session = Depends(get_db)):
    record = db.get(DietAdherence, record_id)
    if record is None:
        raise HTTPException(404, "Diet adherence record not found")
    recommendation = db.get(DietRecommendation, record.recommendation_id)
    if recommendation is None:
        raise HTTPException(404, "Diet recommendation not found")
    access(db, actor_caregiver_id, recommendation.patient_id, True)
    try:
        db.delete(record)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"deleted": True}


@router.post("/activities/routines")
def create_routine(payload: ActivityRoutineCreate, db: Session = Depends(get_db)):
    access(db, payload.actor_caregiver_id, payload.patient_id, True)
    return save(db, ActivityRoutine(**payload.model_dump(exclude={"actor_caregiver_id"})))


@router.put("/activities/routines/{record_id}")
def update_routine(record_id: int, payload: ActivityRoutineCreate, db: Session = Depends(get_db)):
    record = db.get(ActivityRoutine, record_id)
    if not record:
        raise HTTPException(404, "Activity routine not found")
    access(db, payload.actor_caregiver_id, record.patient_id, True)
    for key, value in payload.model_dump(exclude={"actor_caregiver_id", "patient_id"}).items():
        setattr(record, key, value)
    return save(db, record)


@router.delete("/activities/routines/{record_id}")
def archive_routine(record_id: int, actor_caregiver_id: int = Query(...), db: Session = Depends(get_db)):
    record = db.get(ActivityRoutine, record_id)
    if record is None:
        raise HTTPException(404, "Activity routine not found")
    access(db, actor_caregiver_id, record.patient_id, True)
    record.active = False
    return save(db, record)


@router.post("/activities/routines/{routine_id}/logs")
def create_activity_log(routine_id: int, payload: ActivityLogCreate, db: Session = Depends(get_db)):
    routine = db.get(ActivityRoutine, routine_id)
    if not routine:
        raise HTTPException(404, "Activity routine not found")
    access(db, payload.actor_caregiver_id, routine.patient_id, True)
    values = payload.model_dump(exclude={"actor_caregiver_id"})
    values["completion_status"] = values.get("completion_status") or ("Completed" if values["completed"] else "Missed")
    values["completed"] = values["completion_status"] == "Completed"
    if not routine.active:
        raise HTTPException(409, "This routine is archived")
    # One check-in per routine and date: subsequent submissions replace it.
    existing = db.scalar(select(ActivityLog).where(ActivityLog.routine_id == routine_id, ActivityLog.log_date == payload.log_date).order_by(ActivityLog.id.desc()))
    if existing:
        for key, value in values.items():
            setattr(existing, key, value)
        return save(db, existing)
    return save(db, ActivityLog(routine_id=routine_id, planned_minutes=routine.duration_minutes, **values))


@router.put("/activities/logs/{record_id}")
def update_activity_log(record_id: int, payload: ActivityLogCreate, db: Session = Depends(get_db)):
    record = db.get(ActivityLog, record_id)
    if not record:
        raise HTTPException(404, "Activity log not found")
    routine = db.get(ActivityRoutine, record.routine_id)
    if not routine:
        raise HTTPException(404, "Activity routine not found")
    access(db, payload.actor_caregiver_id, routine.patient_id, True)
    values = payload.model_dump(exclude={"actor_caregiver_id"})
    values["completion_status"] = values.get("completion_status") or ("Completed" if values["completed"] else "Missed")
    values["completed"] = values["completion_status"] == "Completed"
    for key, value in values.items():
        setattr(record, key, value)
    return save(db, record)


@router.delete("/activities/logs/{record_id}")
def delete_activity_log(record_id: int, actor_caregiver_id: int = Query(...), db: Session = Depends(get_db)):
    record = db.get(ActivityLog, record_id)
    if record is None:
        raise HTTPException(404, "Activity log not found")
    routine = db.get(ActivityRoutine, record.routine_id)
    if routine is None:
        raise HTTPException(404, "Activity routine not found")
    access(db, actor_caregiver_id, routine.patient_id, True)
    try:
        db.delete(record)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"deleted": True}


@router.put("/preferences")
def update_preferences(payload: LifestylePreferenceUpdate, db: Session = Depends(get_db)):
    access(db, payload.actor_caregiver_id, payload.patient_id, True)
    preference = db.scalar(select(LifestylePreference).where(LifestylePreference.patient_id == payload.patient_id))
    if preference is None:
        preference = LifestylePreference(patient_id=payload.patient_id)
        db.add(preference)
    preference.water_goal_ml = payload.water_goal_ml
    preference.sleep_goal_minutes = payload.sleep_goal_minutes
    return save(db, preference)


@router.post("/weight")
def create_weight(payload: WeightCreate, db: Session = Depends(get_db)):
    access(db, payload.actor_caregiver_id, payload.patient_id, True)
    existing = db.scalar(select(WeightEntry).where(WeightEntry.patient_id == payload.patient_id, WeightEntry.entry_date == payload.entry_date).order_by(WeightEntry.id.desc()))
    if existing:
        for key, value in payload.model_dump(exclude={"actor_caregiver_id", "patient_id"}).items(): setattr(existing, key, value)
        return save(db, existing)
    return save(db, WeightEntry(**payload.model_dump(exclude={"actor_caregiver_id"})))


@router.put("/weight/{record_id}")
def update_weight(record_id: int, payload: WeightCreate, db: Session = Depends(get_db)):
    record = db.get(WeightEntry, record_id)
    if not record:
        raise HTTPException(404, "Weight record not found")
    access(db, payload.actor_caregiver_id, record.patient_id, True)
    for key, value in payload.model_dump(exclude={"actor_caregiver_id", "patient_id"}).items():
        setattr(record, key, value)
    return save(db, record)


@router.delete("/weight/{record_id}")
def delete_weight(record_id: int, actor_caregiver_id: int = Query(...), db: Session = Depends(get_db)):
    return delete_lifestyle_record(db.get(WeightEntry, record_id), actor_caregiver_id, db)


@router.post("/nutrition")
def create_nutrition(payload: NutritionCreate, db: Session = Depends(get_db)):
    access(db, payload.actor_caregiver_id, payload.patient_id, True)
    if payload.recommendation_id:
        plan = db.get(DietRecommendation, payload.recommendation_id)
        if plan is None or plan.patient_id != payload.patient_id or not plan.active:
            raise HTTPException(422, "Select an active nutrition plan belonging to this patient")
    return save(db, NutritionLog(**payload.model_dump(exclude={"actor_caregiver_id"})))
