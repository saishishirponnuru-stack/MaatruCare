from datetime import date, datetime, time

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    status: str = "Not recorded"
    duration_hours: float | None = Field(default=None, gt=0, le=16)
    bedtime: time | None = None
    wake_time: time | None = None
    interruptions: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in {"Sound and adequate", "Sound but fewer hours", "Disturbed and inadequate", "Restful", "Fair", "Disturbed", "Not recorded"}:
            raise ValueError("Unsupported sleep status")
        return value

    @model_validator(mode="after")
    def valid_duration(self):
        if (self.bedtime is None) != (self.wake_time is None):
            raise ValueError("Provide both bedtime and wake-up time")
        if self.bedtime is not None:
            minutes = ((self.wake_time.hour * 60 + self.wake_time.minute) - (self.bedtime.hour * 60 + self.bedtime.minute)) % 1440
            if not 0 < minutes <= 960:
                raise ValueError("Sleep duration must be greater than zero and no more than 16 hours")
        elif self.duration_hours is None:
            raise ValueError("Provide sleep times or a duration")
        return self


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
    completion_status: Literal["Completed", "Partially completed", "Missed"] | None = None
    actual_minutes: int | None = Field(default=None, ge=0, le=1440)
    notes: str | None = Field(default=None, max_length=1000)
    missed_reason: str | None = Field(default=None, max_length=1000)
    actor_caregiver_id: int

    @model_validator(mode="after")
    def consistent_status(self):
        self.completion_status = self.completion_status or ("Completed" if self.completed else "Missed")
        self.completed = self.completion_status == "Completed"
        if self.completion_status == "Missed" and self.actual_minutes:
            raise ValueError("A missed activity must have zero or no actual minutes")
        return self


class NutritionCreate(LifestyleBase):
    log_date: date
    meal_type: Literal["Breakfast", "Lunch", "Dinner", "Snack", "Other"]
    notes: str | None = Field(default=None, max_length=1000)
    recommendation_id: int | None = None
    adherence: Literal["Followed", "Partially followed", "Not followed"] | None = None

    @model_validator(mode="after")
    def plan_required(self):
        if self.adherence and not self.recommendation_id:
            raise ValueError("Select a plan before recording adherence")
        return self


class WeightCreate(LifestyleBase):
    entry_date: date
    weight_kg: float = Field(gt=0, le=500)
    notes: str | None = Field(default=None, max_length=1000)


class LifestylePreferenceUpdate(BaseModel):
    patient_id: int = 1
    actor_caregiver_id: int
    water_goal_ml: int | None = Field(default=None, ge=1, le=20000)
    sleep_goal_minutes: int | None = Field(default=None, ge=1, le=960)


class LifestyleResetRequest(BaseModel):
    patient_id: int = 1
    actor_caregiver_id: int
    reset_preferences: bool = False
    confirmed: bool = False
    expected_counts: dict[str, int] | None = None


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
    planned_minutes: int | None = None
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
    nutrition: list["NutritionResponse"] = []
    water: list[WaterResponse]
    sleep: list[SleepResponse]
    weight: list[WeightResponse]
    diet_recommendations: list[DietRecommendationResponse]
    diet_adherence: list[DietAdherenceResponse]
    routines: list[ActivityRoutineResponse]
    activity_logs: list[ActivityLogResponse]
    preferences: LifestylePreferenceResponse


class NutritionResponse(LifestyleResponseBase):
    id: int
    patient_id: int
    log_date: date
    meal_type: str
    notes: str | None
    recommendation_id: int | None
    adherence: str | None
    created_at: datetime
