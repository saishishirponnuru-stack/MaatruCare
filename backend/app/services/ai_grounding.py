"""Deterministic source checks shared by generation and the persistence boundary."""
from ..ai_schemas import WorkspaceOutput


class WorkspaceVerificationError(ValueError):
    """Contains only a schema path and rule, never source or generated content."""


def verify_workspace(output: WorkspaceOutput, note: str) -> WorkspaceOutput:
    for group in ("facts", "responsibilities", "suggestions"):
        for index, item in enumerate(getattr(output, group)):
            if not item.source_quote.strip() or item.source_quote not in note:
                raise WorkspaceVerificationError(f"{group}.{index}.source_quote: must be an exact contiguous quote from the note")
    for group in ("dates", "times", "people"):
        for index, value in enumerate(getattr(output, group)):
            if not value.strip() or value not in note:
                raise WorkspaceVerificationError(f"{group}.{index}: must be copied verbatim from the note, not reformatted or translated")
    for index, suggestion in enumerate(output.suggestions):
        if suggestion.assignee_name and suggestion.assignee_name not in note:
            raise WorkspaceVerificationError(f"suggestions.{index}.assignee_name: must be a name explicitly present in the note or null")
        if suggestion.due_date and suggestion.due_date.isoformat() not in note:
            raise WorkspaceVerificationError(f"suggestions.{index}.due_date: requires an explicit YYYY-MM-DD date in the note; otherwise use null and request clarification")
    return output
