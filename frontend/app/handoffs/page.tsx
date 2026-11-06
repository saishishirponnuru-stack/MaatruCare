"use client";

import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useState } from "react";
import { Check, CheckCircle2, Clock3, FileText, Plus, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useMaatruCareDemo, type DemoHandoff, type DemoHandoffStage, type DemoOwner } from "@/context/MaatruCareDemoContext";

type CreateForm = { from: DemoOwner; to: DemoOwner; reason: string };
const people: DemoOwner[] = ["Rahul Rao", "Lakshmi Rao", "Priya Rao"];
const stages: DemoHandoffStage[] = ["Prepared", "Sent", "Acknowledged", "Completed"];
const initialForm: CreateForm = { from: "Rahul Rao", to: "Lakshmi Rao", reason: "Appointment coordination" };

export default function HandoffsPage() {
  const { handoffs, error: apiError, createHandoff: createHandoffAction, sendHandoff, acknowledgeHandoff, completeHandoff } = useMaatruCareDemo();
  const [selectedId, setSelectedId] = useState("handoff-1");
  const [modal, setModal] = useState<"review" | "create" | null>(null);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState<CreateForm>(initialForm);
  const selected = handoffs.find((handoff) => handoff.id === selectedId) ?? handoffs[0];
  const active = handoffs.filter((handoff) => handoff.stage !== "Completed").length;
  const awaiting = handoffs.filter((handoff) => handoff.stage === "Sent").length;
  const completed = handoffs.filter((handoff) => handoff.stage === "Completed").length;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  async function acceptHandoff() {
    if (!selected) return;
    try { await acknowledgeHandoff(selected.id); setModal(null); notify("Handoff acknowledgement saved."); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to acknowledge handoff."); }
  }

  async function completeSelectedHandoff() {
    if (!selected) return;
    try { await completeHandoff(selected.id); notify("Handoff completion saved."); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to complete handoff."); }
  }

  async function sendSelectedHandoff() {
    if (!selected) return;
    try { await sendHandoff(selected.id); notify("Handoff sent."); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to send handoff."); }
  }

  async function createHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.from === form.to) {
      notify("Choose two different caregivers for this handoff.");
      return;
    }
    try {
      const id = await createHandoffAction({ title: "Coordination handoff", ...form });
      setSelectedId(id);
      setModal(null);
      setForm(initialForm);
      notify("Handoff created.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to create handoff.");
    }
  }

  return (
    <AppShell>
      <div>
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Care coordination</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">Care handoffs</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">Track backend-supported responsibility handoffs between configured demo caregivers.</p>
          </div>
          <button type="button" onClick={() => setModal("create")} className="flex items-center justify-center gap-2 rounded-[13px] bg-[#6D3A5B] px-4 py-2.5 text-xs font-semibold text-white"><Plus size={15} />Create handoff</button>
        </header>

        <div className="mt-6 flex gap-4 rounded-[20px] border border-[#E4D7DF] bg-[#F8F2F6] p-5">
          <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#6D3A5B]" />
          <p className="self-center text-xs leading-5 text-[#756D72]">This screen shows synthetic handoff records. The backend stores participants, reason, status, and timestamps; it does not attach appointment/task details or implement a request-changes action. Permission checks remain server-enforced.</p>
        </div>

        {toast && <div role="status" className="mt-5 rounded-[12px] border border-[#CFE0D5] bg-[#F1F8F3] px-3 py-2 text-xs font-medium text-[#3F6D56]">{toast}</div>}
        {apiError && <div role="alert" className="mt-5 rounded-[12px] border border-[#E7C8CC] bg-[#FFF5F5] px-3 py-2 text-xs font-medium text-[#9D4B55]">{apiError}</div>}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Active" value={active} />
          <Kpi label="Awaiting acknowledgement" value={awaiting} />
          <Kpi label="Completed" value={completed} />
          <Kpi label="Total handoffs" value={handoffs.length} />
        </div>

        {selected ? <HandoffCard handoff={selected} onSend={sendSelectedHandoff} onReview={() => setModal("review")} onComplete={completeSelectedHandoff} /> : <div className="mt-8 rounded-[18px] border border-dashed border-[#D8C5D0] bg-white p-8 text-center"><p className="text-sm font-semibold text-[#211C1F]">No handoffs are currently loaded</p><p className="mt-2 text-xs text-[#756D72]">Create a handoff only if the backend list loaded successfully.</p></div>}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <section>
            <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Completed records</p><h2 className="mt-1 text-[17px] font-semibold text-[#211C1F]">Completed handoffs</h2></div><span className="text-[10px] text-[#9A9196]">Backend records · not a separate audit log</span></div>
            <div className="mt-4 rounded-[18px] border border-[#E9E1E4] bg-white px-5">{handoffs.filter((handoff) => handoff.stage === "Completed").map((handoff) => <HistoryRow key={handoff.id} title={handoff.title} people={`${handoff.from} → ${handoff.to}`} date={`Created ${handoff.created}`} />)}{completed === 0 && <p className="py-5 text-xs text-[#9A9196]">No completed handoffs yet.</p>}</div>
          </section>
          <div className="space-y-6">
            <section className="rounded-[18px] border border-[#E4D7DF] bg-[#F8F2F6] p-5">
              <div className="flex items-center gap-3"><ShieldCheck size={18} className="text-[#6D3A5B]" /><h2 className="text-sm font-semibold text-[#211C1F]">Sharing permissions</h2></div>
              <p className="mt-3 text-[11px] leading-5 text-[#756D72]">Backend permission checks remain authoritative. This screen does not grant access by displaying illustrative labels.</p>
              <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-semibold text-[#6D3A5B]"><Link href="/consent">Review Consent</Link><Link href="/care-circle">View Care Circle</Link><Link href="/timeline">View Timeline</Link></div>
            </section>
            <section className="rounded-[18px] border border-[#E9E1E4] bg-white p-5">
              <div className="flex items-center gap-3"><Clock3 size={17} className="text-[#6D3A5B]" /><h2 className="text-sm font-semibold text-[#211C1F]">Care Handoff Lag</h2></div>
              <p className="mt-3 text-[11px] leading-5 text-[#756D72]">Time between responsibility changing and receiving-caregiver acknowledgement. This demo has no validated performance result.</p>
              <span className="mt-3 inline-block rounded-full bg-[#FBF8F7] px-2.5 py-1 text-[9px] font-semibold text-[#9A9196]">Synthetic example · no metric available</span>
            </section>
          </div>
        </div>

        <div className="mt-6 flex gap-3 rounded-[16px] bg-[#FBF8F7] p-4"><ShieldAlert size={16} className="mt-0.5 shrink-0 text-[#6D3A5B]" /><p className="text-[11px] leading-5 text-[#756D72]">MaatruCare coordinates responsibilities. It does not diagnose, predict medical risk, recommend treatment, or make clinical decisions.</p></div>
      </div>

      <AnimatePresence>
        {modal && <HandoffModal mode={modal} selected={selected} form={form} setForm={setForm} onClose={() => setModal(null)} onAccept={acceptHandoff} onCreate={createHandoff} />}
      </AnimatePresence>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[18px] border border-[#E9E1E4] bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">{label}</p><p className="mt-2 text-2xl font-semibold text-[#211C1F]">{value}</p></div>;
}

function Person({ label, name }: { label: string; name: DemoOwner }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9A9196]">{label}</p><div className="mt-3 flex items-center gap-3"><div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8D7E0] text-[11px] font-semibold text-[#6D3A5B]">{name.split(" ").map((part) => part[0]).join("")}</div><p className="text-xs font-semibold text-[#211C1F]">{name}</p></div></div>;
}

function HandoffCard({ handoff, onSend, onReview, onComplete }: { handoff: DemoHandoff; onSend: () => void; onReview: () => void; onComplete: () => void }) {
  const current = stages.indexOf(handoff.stage);
  return (
    <section className="mt-8 rounded-[22px] border border-[#E9E1E4] bg-white shadow-[0_8px_30px_rgba(33,28,31,0.035)]">
      <div className="flex flex-col gap-3 border-b border-[#F0E9EC] px-6 py-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">{handoff.stage === "Completed" ? "Completed handoff" : "Active handoff"}</p><h2 className="mt-1 text-[20px] font-semibold text-[#211C1F]">{handoff.title}</h2></div><span className="w-fit rounded-full bg-[#F3EAF0] px-3 py-1.5 text-[10px] font-semibold text-[#6D3A5B]">{handoff.stage === "Sent" ? "Awaiting acknowledgement" : handoff.stage}</span></div>
      <div className="grid gap-8 px-6 py-6 xl:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="grid gap-5 sm:grid-cols-2"><Person label="From" name={handoff.from} /><Person label="To" name={handoff.to} /></div>
          <div className="mt-6 rounded-[16px] bg-[#FBF8F7] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9A9196]">Reason</p><p className="mt-2 text-xs text-[#211C1F]">{handoff.reason}</p></div>
          <p className="mt-5 flex items-center gap-1.5 text-[10px] text-[#9A9196]"><Clock3 size={13} />Created {handoff.created}</p>
          <div className="mt-6 flex flex-wrap gap-2">{handoff.stage === "Prepared" && <button type="button" onClick={onSend} className="rounded-[13px] bg-[#6D3A5B] px-4 py-3 text-xs font-semibold text-white">Send handoff</button>}{handoff.stage === "Sent" && <button type="button" onClick={onReview} className="rounded-[13px] bg-[#6D3A5B] px-4 py-3 text-xs font-semibold text-white">Review handoff</button>}{handoff.stage === "Acknowledged" && <button type="button" onClick={onComplete} className="rounded-[13px] bg-[#6D3A5B] px-4 py-3 text-xs font-semibold text-white">Mark coordination complete</button>}</div>
          {handoff.stage === "Acknowledged" && <p className="mt-4 flex items-center gap-2 text-xs font-medium text-[#4F8068]"><CheckCircle2 size={15} />Acknowledgement recorded for {handoff.to}.</p>}
        </div>
        <div className="rounded-[18px] border border-[#F0E9EC] bg-[#FFFCFB] p-5"><div className="flex items-center gap-2"><FileText size={15} className="text-[#6D3A5B]" /><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Stored handoff fields</p></div><p className="mt-4 text-xs leading-5 text-[#756D72]">Participants, reason, status, and timestamps come from the backend. Appointment details, related tasks, and approved context are not attached to this record.</p></div>
      </div>
      <div className="border-t border-[#F0E9EC] px-6 py-6"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Handoff progress</p><div className="mt-5 grid gap-4 sm:grid-cols-4">{stages.map((stage, index) => <div key={stage} className="flex items-center gap-2 sm:block"><div className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${index < current || handoff.stage === "Completed" ? "border-[#4F8068] bg-[#E7EEE9] text-[#4F8068]" : index === current ? "border-[#6D3A5B] bg-[#F3EAF0] text-[#6D3A5B]" : "border-[#E2D9DD] text-[#9A9196]"}`}>{index < current || handoff.stage === "Completed" ? <Check size={12} /> : index + 1}</div><p className={`text-[10px] sm:mt-2 ${index === current ? "font-semibold text-[#6D3A5B]" : "text-[#9A9196]"}`}>{stage}</p></div>)}</div></div>
    </section>
  );
}

function HistoryRow({ title, people, date }: { title: string; people: string; date: string }) {
  return <div className="flex items-center gap-4 border-b border-[#F0E9EC] py-4 last:border-0"><CheckCircle2 size={18} className="text-[#4F8068]" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#211C1F]">{title}</p><p className="mt-1 text-[10px] text-[#756D72]">{people}</p></div><span className="text-[10px] text-[#9A9196]">{date}</span></div>;
}

function HandoffModal({ mode, selected, form, setForm, onClose, onAccept, onCreate }: { mode: "review" | "create"; selected: DemoHandoff | undefined; form: CreateForm; setForm: (form: CreateForm) => void; onClose: () => void; onAccept: () => void; onCreate: (event: FormEvent<HTMLFormElement>) => void }) {
  return <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" />
    <motion.aside role="dialog" aria-modal="true" aria-labelledby="handoff-dialog-title" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[#E9E1E4] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#E9E1E4] px-6 py-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">{mode === "create" ? "New handoff" : "Receiving caregiver review"}</p><h2 id="handoff-dialog-title" className="mt-1 text-lg font-semibold text-[#211C1F]">{mode === "create" ? "Prepare handoff" : selected?.title ?? "Review handoff"}</h2></div><button type="button" onClick={onClose} aria-label="Close handoff dialog" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F3F5] text-[#756D72]"><X size={17} /></button></div>
      {mode === "review" && selected ? <div className="flex flex-1 flex-col"><div className="flex-1 space-y-5 overflow-y-auto px-6 py-6"><Person label="From" name={selected.from} /><Person label="To" name={selected.to} /><Info label="Reason" value={selected.reason} /><div className="rounded-[14px] bg-[#F8F2F6] p-4"><p className="text-xs font-semibold text-[#211C1F]">Request changes is unavailable</p><p className="mt-2 text-[11px] leading-5 text-[#756D72]">The backend has no request-changes endpoint. This review view also contains no attached appointment or task context.</p></div></div><div className="grid gap-2 border-t border-[#E9E1E4] p-6 sm:grid-cols-2"><button type="button" onClick={onAccept} className="rounded-[12px] bg-[#6D3A5B] py-3 text-xs font-semibold text-white">Acknowledge handoff</button><button type="button" onClick={onClose} className="rounded-[12px] border border-[#E9E1E4] py-3 text-xs font-semibold text-[#6D3A5B]">Close</button></div></div> : <form onSubmit={onCreate} className="flex min-h-0 flex-1 flex-col"><div className="flex-1 space-y-5 overflow-y-auto px-6 py-6"><SelectField label="From" value={form.from} options={people} onChange={(value) => setForm({ ...form, from: value as DemoOwner })} /><SelectField label="To" value={form.to} options={people} onChange={(value) => setForm({ ...form, to: value as DemoOwner })} /><SelectField label="Reason" value={form.reason} options={["Appointment coordination", "Transport coordination", "Document coordination", "General caregiver support"]} onChange={(value) => setForm({ ...form, reason: value })} /><div className="rounded-[14px] bg-[#F8F2F6] p-4 text-[11px] leading-5 text-[#756D72]">Only participants, reason, and workflow status are persisted. Related tasks, appointment details, and sharing context are not stored on a handoff record.</div></div><div className="border-t border-[#E9E1E4] p-6"><button type="submit" className="w-full rounded-[13px] bg-[#6D3A5B] py-3 text-xs font-semibold text-white">Create handoff</button></div></form>}
    </motion.aside>
  </>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9A9196]">{label}</p><p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#211C1F]">{value}</p></div>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9A9196]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-[12px] border border-[#E9E1E4] px-3 py-2.5 text-xs outline-none focus:border-[#6D3A5B]">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
