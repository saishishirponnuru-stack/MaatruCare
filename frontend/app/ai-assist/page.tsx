"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  History,
  Languages,
  ListChecks,
  LockKeyhole,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  X,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";

type DraftState = "idle" | "processing" | "ready" | "approved" | "rejected";

const demoDraft =
  "Upcoming appointment coordination requires transport confirmation and appointment document preparation.";

const capabilities = [
  {
    title: "Organize documented information",
    description:
      "Extract explicitly documented, non-clinical coordination information from approved notes.",
    icon: FileCheck2,
  },
  {
    title: "Create coordination tasks",
    description:
      "Identify logistical tasks already present in approved information and prepare them for human review.",
    icon: ListChecks,
  },
  {
    title: "Prepare care handoff",
    description:
      "Turn approved coordination context into a concise handoff summary for the receiving caregiver.",
    icon: ClipboardCheck,
  },
  {
    title: "Translate information",
    description:
      "Help present approved coordination information in the patient's preferred language.",
    icon: Languages,
  },
] as const;

const safetyBoundaries = [
  "Diagnose conditions",
  "Predict or calculate medical risk",
  "Assign risk categories",
  "Interpret scans or laboratory results",
  "Recommend treatment",
  "Make clinical decisions",
  "Provide autonomous medical advice",
];

export default function AIAssistPage() {
  const [draftState, setDraftState] = useState<DraftState>("idle");
  const [draft, setDraft] = useState(demoDraft);
  const [editedDraft, setEditedDraft] = useState(demoDraft);
  const [isEditing, setIsEditing] = useState(false);

  function prepareSummary() {
    setDraftState("processing");
    setIsEditing(false);
    window.setTimeout(() => {
      setDraft(demoDraft);
      setEditedDraft(demoDraft);
      setDraftState("ready");
    }, 900);
  }

  function approveDraft() {
    setDraftState("approved");
    setIsEditing(false);
  }

  function rejectDraft() {
    setDraftState("rejected");
    setIsEditing(false);
  }

  function saveEdit() {
    setDraft(editedDraft.trim() || demoDraft);
    setDraftState("ready");
    setIsEditing(false);
  }

  const hasDraft = draftState === "ready" || draftState === "approved" || draftState === "rejected";

  return (
    <AppShell>
      <div>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
              Assistive coordination
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">
              AI Assist
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#756D72]">
              Organize approved care information without making clinical decisions.
            </p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-full border border-[#CFE0D5] bg-[#F1F8F3] px-3.5 py-2 text-[10px] font-semibold text-[#3F6D56]">
            <ShieldCheck size={14} />
            Assistive AI · Human reviewed
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex gap-4 rounded-[20px] border border-[#E4D7DF] bg-[#F8F2F6] p-5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#EBDCE5] text-[#6D3A5B]">
            <Sparkles size={19} />
          </div>
          <p className="self-center max-w-3xl text-xs leading-5 text-[#756D72]">
            MaatruCare AI helps organize approved care information and coordination tasks. A person always reviews information before it is shared.
          </p>
        </motion.div>

        <section className="mt-8">
          <SectionHeading eyebrow="AI capabilities" title="Assistive tools for coordination" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {capabilities.map((capability, index) => {
              const Icon = capability.icon;
              return (
                <motion.div
                  key={capability.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="rounded-[18px] border border-[#E9E1E4] bg-white p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F3EAF0] text-[#6D3A5B]"><Icon size={17} /></div>
                  <h2 className="mt-5 text-sm font-semibold text-[#211C1F]">{capability.title}</h2>
                  <p className="mt-2 text-[11px] leading-5 text-[#756D72]">{capability.description}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[22px] border border-[#E9E1E4] bg-white p-6 shadow-[0_8px_30px_rgba(33,28,31,0.035)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Demo assistive workflow</p>
                <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">Review approved information</h2>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#FBF8F7] text-[#6D3A5B]"><FileText size={17} /></div>
            </div>

            <div className="mt-6 space-y-5">
              <DemoField label="Source" value="Clinic visit note · 22 Sep" />
              <DemoField label="Documented care status" value="Enhanced Observation" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">Coordination information</p>
                <p className="mt-2 rounded-[14px] bg-[#FBF8F7] p-4 text-xs leading-5 text-[#211C1F]">Upcoming clinic appointment requires transport coordination.</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3 rounded-[14px] border border-[#E9E1E4] bg-[#FFFCFB] p-4">
              <LockKeyhole size={16} className="mt-0.5 shrink-0 text-[#6D3A5B]" />
              <p className="text-[10px] leading-4 text-[#756D72]">Synthetic information for demonstration only. No medical details are processed here.</p>
            </div>

            <button
              type="button"
              onClick={prepareSummary}
              disabled={draftState === "processing"}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#6D3A5B] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#4D2941] disabled:cursor-wait disabled:opacity-70"
            >
              <Sparkles size={15} />
              {draftState === "processing" ? "Preparing demo summary..." : "Prepare coordination summary"}
            </button>
          </div>

          <div className="rounded-[22px] border border-[#E9E1E4] bg-white p-6 shadow-[0_8px_30px_rgba(33,28,31,0.035)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Output</p>
                <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">Coordination draft</h2>
              </div>
              <Bot size={19} className="text-[#6D3A5B]" />
            </div>

            {!hasDraft && (
              <div className="mt-6 flex min-h-[250px] flex-col items-center justify-center rounded-[16px] border border-dashed border-[#DCCBD5] bg-[#FFFCFB] px-6 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F3EAF0] text-[#6D3A5B]"><Sparkles size={19} /></div>
                <p className="mt-4 text-sm font-semibold text-[#211C1F]">Ready for a human-reviewed draft</p>
                <p className="mt-2 max-w-sm text-[11px] leading-5 text-[#9A9196]">Prepare a summary from the synthetic coordination information on the left.</p>
              </div>
            )}

            {draftState === "processing" && (
              <div className="mt-6 flex min-h-[250px] items-center justify-center rounded-[16px] bg-[#FBF8F7] text-xs font-medium text-[#6D3A5B]">
                <span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-[#B86B87]" /> Organizing approved coordination information...</span>
              </div>
            )}

            {hasDraft && (
              <>
                <div className="mt-6 rounded-[16px] border border-[#E4D7DF] bg-[#F8F2F6] p-4">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-[#6D3A5B]"><Sparkles size={13} /> AI-generated draft · Requires human review</div>
                  {isEditing ? (
                    <textarea value={editedDraft} onChange={(event) => setEditedDraft(event.target.value)} rows={4} className="mt-4 w-full resize-none rounded-[11px] border border-[#D8C5D0] bg-white p-3 text-xs leading-5 text-[#211C1F] outline-none focus:border-[#6D3A5B]" aria-label="Edit coordination draft" />
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-[#211C1F]">{draft}</p>
                  )}
                </div>

                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">Suggested coordination tasks</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <TaskSuggestion title="Confirm transport" />
                    <TaskSuggestion title="Prepare appointment documents" />
                  </div>
                </div>

                {draftState === "ready" && !isEditing && (
                  <ReviewPanel onApprove={approveDraft} onEdit={() => { setEditedDraft(draft); setIsEditing(true); }} onReject={rejectDraft} />
                )}
                {draftState === "ready" && isEditing && (
                  <button type="button" onClick={saveEdit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#6D3A5B] py-3 text-xs font-semibold text-white transition hover:bg-[#4D2941]"><Check size={15} />Save edited draft</button>
                )}
                {draftState === "approved" && <ApprovedState />}
                {draftState === "rejected" && <RejectedState onPrepare={prepareSummary} />}
              </>
            )}
          </div>
        </section>

        {draftState === "approved" && (
          <section className="mt-6 rounded-[20px] border border-[#CFE0D5] bg-[#F1F8F3] p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#E0EFE4] text-[#4F8068]"><ShieldCheck size={19} /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4F8068]">Patient control</p><h2 className="mt-1 text-sm font-semibold text-[#211C1F]">Approved for patient-controlled sharing</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[#5D7064]">Approved information is not shared automatically. Sharing follows the patient&apos;s Care Circle permissions.</p></div></div>
              <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0"><ControlLink href="/consent" label="Consent" /><ControlLink href="/care-circle" label="Care Circle" /><ControlLink href="/timeline" label="Timeline" /></div>
            </div>
          </section>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="rounded-[20px] border border-[#E6D8D8] bg-[#FFF9F8] p-6">
            <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F8E8E6] text-[#B85C62]"><ShieldAlert size={17} /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B85C62]">Safety boundary</p><h2 className="mt-1 text-[17px] font-semibold text-[#211C1F]">What MaatruCare AI does NOT do</h2></div></div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">{safetyBoundaries.map((item) => <li key={item} className="flex items-start gap-2 text-[11px] leading-5 text-[#756D72]"><X size={14} className="mt-0.5 shrink-0 text-[#B85C62]" />{item}</li>)}</ul>
          </section>

          <section className="rounded-[20px] border border-[#E9E1E4] bg-white p-6 shadow-[0_8px_30px_rgba(33,28,31,0.025)]">
            <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#FBF8F7] text-[#6D3A5B]"><History size={17} /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Audit trail</p><h2 className="mt-1 text-[17px] font-semibold text-[#211C1F]">Review activity</h2></div></div>
            {draftState === "approved" ? <div className="mt-5 rounded-[14px] border border-[#CFE0D5] bg-[#F1F8F3] p-4"><div className="flex items-start gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#E0EFE4] text-[#4F8068]"><CheckCircle2 size={16} /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#211C1F]">AI coordination draft reviewed and approved</p><p className="mt-2 text-[10px] text-[#756D72]">Actor: Patient / authorized reviewer</p><p className="mt-1 text-[10px] font-semibold text-[#4F8068]">Status: Approved</p></div></div><Link href="/timeline" className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold text-[#6D3A5B]">View in Timeline <ArrowUpRight size={13} /></Link></div> : <div className="mt-5 rounded-[14px] bg-[#FBF8F7] p-4 text-[11px] leading-5 text-[#9A9196]">An audit entry will appear here after a person approves the demo draft.</div>}
          </section>
        </div>

        <div className="mt-6 flex gap-3 rounded-[16px] bg-[#FBF8F7] p-4"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#6D3A5B]" /><p className="text-[11px] leading-5 text-[#756D72]">This is a synthetic demonstration of an assistive workflow. A person remains responsible for reviewing and deciding what can be shared.</p></div>
      </div>
    </AppShell>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">{eyebrow}</p><h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">{title}</h2></div>;
}

function DemoField({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[#F0E9EC] pb-4"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">{label}</span><span className="text-right text-xs font-medium text-[#211C1F]">{value}</span></div>;
}

function TaskSuggestion({ title }: { title: string }) {
  return <div className="flex items-center gap-2 rounded-[11px] border border-[#E9E1E4] bg-white px-3 py-2.5 text-[11px] font-medium text-[#211C1F]"><Check size={13} className="text-[#4F8068]" />{title}</div>;
}

function ReviewPanel({ onApprove, onEdit, onReject }: { onApprove: () => void; onEdit: () => void; onReject: () => void }) {
  return <div className="mt-6 rounded-[16px] border border-[#E9E1E4] bg-[#FFFCFB] p-4"><div className="flex items-center gap-2"><UserRoundCheck size={16} className="text-[#6D3A5B]" /><p className="text-xs font-semibold text-[#211C1F]">Human review required</p></div><p className="mt-2 text-[10px] leading-4 text-[#756D72]">Check the draft and suggested tasks before deciding whether anything may be shared.</p><div className="mt-4 grid gap-2 sm:grid-cols-3"><button type="button" onClick={onApprove} className="flex items-center justify-center gap-1.5 rounded-[11px] bg-[#6D3A5B] px-3 py-2.5 text-[11px] font-semibold text-white transition hover:bg-[#4D2941]"><Check size={14} />Approve</button><button type="button" onClick={onEdit} className="flex items-center justify-center gap-1.5 rounded-[11px] border border-[#D8C5D0] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#6D3A5B] transition hover:bg-[#F8F2F6]"><Pencil size={14} />Edit</button><button type="button" onClick={onReject} className="flex items-center justify-center gap-1.5 rounded-[11px] border border-[#E7D2D2] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#B85C62] transition hover:bg-[#FFF5F4]"><X size={14} />Reject</button></div></div>;
}

function ApprovedState() {
  return <div className="mt-6 flex items-center gap-3 rounded-[14px] border border-[#CFE0D5] bg-[#F1F8F3] p-4"><CheckCircle2 size={18} className="shrink-0 text-[#4F8068]" /><div><p className="text-xs font-semibold text-[#211C1F]">Approved for patient-controlled sharing</p><p className="mt-1 text-[10px] leading-4 text-[#5D7064]">The draft is ready to follow the patient&apos;s sharing permissions.</p></div></div>;
}

function RejectedState({ onPrepare }: { onPrepare: () => void }) {
  return <div className="mt-6 rounded-[14px] border border-[#E7D2D2] bg-[#FFF5F4] p-4"><p className="text-xs font-semibold text-[#8D4B50]">Draft rejected - nothing was shared</p><button type="button" onClick={onPrepare} className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-[#6D3A5B]">Prepare another demo draft <ArrowRight size={13} /></button></div>;
}

function ControlLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="flex items-center justify-center gap-1 rounded-[11px] border border-[#CFE0D5] bg-white px-3 py-2 text-[10px] font-semibold text-[#4F8068] transition hover:bg-[#EAF4ED]">{label}<ChevronRight size={13} /></Link>;
}

