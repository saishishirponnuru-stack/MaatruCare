from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

Operation = Literal["summarize", "extract_tasks", "appointment_prep", "handoff_draft", "update_draft", "nutrition_notes", "care_plan"]


class WorkspaceRequest(BaseModel):
    note: str = Field(min_length=10, max_length=3000)
    operation: Operation
    language: Literal["English", "Hindi", "Telugu"] = "English"
    external_processing_consent: bool = False


class Fact(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=400)
    source_quote: str = Field(min_length=1, max_length=500)


class Suggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=255)
    kind: Literal["From note", "Suggestion"]
    source_quote: str = Field(min_length=1, max_length=500)
    assignee_name: str | None = Field(default=None, max_length=200)
    due_date: date | None = None


class WorkspaceOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str = Field(min_length=1, max_length=2000)
    facts: list[Fact] = Field(default_factory=list, max_length=10)
    dates: list[str] = Field(default_factory=list, max_length=10)
    times: list[str] = Field(default_factory=list, max_length=10)
    people: list[str] = Field(default_factory=list, max_length=10)
    responsibilities: list[Fact] = Field(default_factory=list, max_length=10)
    missing_information: list[str] = Field(default_factory=list, max_length=8)
    suggestions: list[Suggestion] = Field(default_factory=list, max_length=8)
    handoff_title: str | None = Field(default=None, max_length=255)
    handoff_summary: str | None = Field(default=None, max_length=2000)
    care_update: str | None = Field(default=None, max_length=2000)


class DraftReview(BaseModel):
    action: Literal["approve", "reject"]
    edited_text: str | None = Field(default=None, max_length=3000)
    suggestion_index: int | None = Field(default=None, ge=0, le=7)
