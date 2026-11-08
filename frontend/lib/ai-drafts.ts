import type { AIDraft } from "./api";

/** The schema allows optional fields for every tool. Only use this tool's field. */
export function editableDraftText(draft: Pick<AIDraft, "operation" | "output">) {
  const specific = draft.operation === "update_draft" ? draft.output.care_update
    : draft.operation === "handoff_draft" ? draft.output.handoff_summary : null;
  return specific?.trim() ? specific : draft.output.summary;
}
