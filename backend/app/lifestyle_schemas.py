from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LifestyleBase(BaseModel):
    patient_id: int = 1
    actor_caregiver_id: int


class WaterCreate(LifestyleBase):
    log_date: date
    status: str
    quantity_ml: int | None = Field(default=None, ge=1, le=20000)
    goal_ml: int | None = Field(default=None, ge=0, le=20000)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in {"Adequate", "Not adequate"}:
            raise ValueError("Water status must be Adequate or Not adequate")
        return value


class SleepCreate(LifestyleBase):
    log_date: date
    status: str
    duration_hours: float | None = Field(default=None, ge=0, le=24)
    bedtime: time | None = None
    wake_time: time | None = None
    interruptions: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in {"Sound and adequate", "Sound but fewer hours", "Disturbed and inadequate", "Restful", "Fair", "Disturbed"}:
            raise ValueError("Unsupported sleep status")
        return value


class DietRecommendationCreate(LifestyleBase):
    title: str = Field(min_length=1, max_length=200)
    instructions: str = Field(min_length=1, max_length=4000)
    clinician_name: str | None = Field(default=None, max_length=200)
    start_date: date
    end_date: date | None = None
    active: bool = True


class DietAdherenceCreate(BaseModel):
    log_date: date
    status: str
    reason: str | None = Field(default=None, max_length=1000)
    actor_caregiver_id: int

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in {"Followed", "Partially followed", "Not followed", "Not recorded"}:
            raise ValueError("Unsupported adherence status")
        return value


class ActivityRoutineCreate(LifestyleBase):
    name: str = Field(min_length=1, max_length=160)
    activity_type: str
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)
    advised_source: str | None = Field(default=None, max_length=200)
    active: bool = True

    @field_validator("activity_type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        if value not in {"Exercise", "Meditation", "Other"}:
            raise ValueError("Unsupported activity type")
        return value


class ActivityLogCreate(BaseModel):
    log_date: date
    completed: bool
    completion_status: str | None = None
    actual_minutes: int | None = Field(default=None, ge=0, le=1440)
    notes: str | None = Field(default=None, max_length=1000)
    missed_reason: str | None = Field(default=None, max_length=1000)
    actor_caregiver_id: int


class WeightCreate(LifestyleBase):
    entry_date: date
    weight_kg: float = Field(gt=0, le=500)
    notes: str | None = Field(default=None, max_length=1000)


class LifestylePreferenceUpdate(BaseModel):
    patient_id: int = 1
    actor_caregiver_id: int
    water_goal_ml: int | None = Field(default=None, ge=1, le=20000)
    sleep_goal_minutes: int | None = Field(default=None, ge=1, le=1440)


class LifestyleResetRequest(BaseModel):
    patient_id: int = 1
    actor_caregiver_id: int
    reset_preferences: bool = False


class LifestyleResetResponse(BaseModel):
    deleted: dict[str, int]
    preferences_reset: bool


class LifestyleResponseBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class WaterResponse(LifestyleResponseBase):
    id: int
    patient_id: int
    log_date: date
    status: str
    quantity_ml: int | None
    goal_ml: int | None
    notes: str | None
    created_at: datetime


class SleepResponse(LifestyleResponseBase):
    id: int
    patient_id: int
    log_date: date
    status: str
    duration_hours: float | None
    bedtime: time | None
    wake_time: time | None
    interruptions: int | None
    notes: str | None
    created_at: datetime


class DietRecommendationResponse(LifestyleResponseBase):
    id: int
    patient_id: int
    title: str
    instructions: str
    clinician_name: str | None
    start_date: date
    end_date: date | None
    active: bool
    created_at: datetime


class DietAdherenceResponse(LifestyleResponseBase):
    id: int
    recommendation_id: int
    log_date: date
    status: str
    reason: str | None
    created_at: datetime


class ActivityRoutineResponse(LifestyleResponseBase):
    id: int
    patient_id: int
    name: str
    activity_type: str
    duration_minutes: int | None
    advised_source: str | None
    active: bool
    created_at: datetime


class ActivityLogResponse(LifestyleResponseBase):
    id: int
    routine_id: int
    log_date: date
    completed: bool
    completion_status: str | None
    actual_minutes: int | None
    notes: str | None
    missed_reason: str | None
    created_at: datetime


class WeightResponse(LifestyleResponseBase):
    id: int
    patient_id: int
    entry_date: date
    weight_kg: float
    notes: str | None
    created_at: datetime


class LifestylePreferenceResponse(LifestyleResponseBase):
    id: int
    patient_id: int
    water_goal_ml: int | None
    sleep_goal_minutes: int | None
    updated_at: datetime


class LifestyleResponse(BaseModel):
    water: list[WaterResponse]
    sleep: list[SleepResponse]
    weight: list[WeightResponse]
    diet_recommendations: list[DietRecommendationResponse]
    diet_adherence: list[DietAdherenceResponse]
    routines: list[ActivityRoutineResponse]
    activity_logs: list[ActivityLogResponse]
    preferences: LifestylePreferenceResponse
