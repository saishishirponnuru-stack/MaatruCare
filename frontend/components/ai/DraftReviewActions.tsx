"use client";

import { Check } from "lucide-react";
import type { AIDraft } from "@/lib/api";
import { editableDraftText } from "@/lib/ai-drafts";
import { Button, Field } from "@/components/ui/ProductUI";
import ActionFeedback from "./ActionFeedback";

export default function DraftReviewActions({ draft, edited, onEdit, onApprove, onReject, busy, pendingAction, feedback }: {
  draft: AIDraft; edited: string; onEdit: (text: string) => void; onApprove: () => void; onReject: () => void;
  busy: boolean; pendingAction: string | null; feedback?: { text: string; error: boolean };
}) {
  const approved = draft.status === "Approved" && edited.trim() === editableDraftText(draft).trim();
  return <div className="mt-5" data-testid="draft-review-actions">
    <Field label="Editable draft"><textarea disabled={busy} value={edited} maxLength={3000} onChange={event => onEdit(event.target.value)} /></Field>
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || !edited.trim() || approved} aria-busy={pendingAction === "draft-approve"} onClick={onApprove}>
        <Check size={16} />{pendingAction === "draft-approve" ? "Approving draft…" : approved ? "Draft approved" : "Approve draft"}
      </Button>
      <Button variant="secondary" disabled={busy || draft.status === "Rejected"} aria-busy={pendingAction === "draft-reject"} onClick={onReject}>
        {pendingAction === "draft-reject" ? "Rejecting draft…" : draft.status === "Rejected" ? "Draft rejected" : "Reject draft"}
      </Button>
    </div>
    <ActionFeedback feedback={feedback} />
    {approved && <p className="mc-caption mt-3">Draft approval is saved. Each proposed task still needs your individual review.</p>}
  </div>;
}
