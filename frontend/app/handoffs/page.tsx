"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge, Button, Drawer, Field, Message, PageHeading, Panel, Stat } from "@/components/ui/ProductUI";
import { useMaatruCareDemo, type DemoHandoff } from "@/context/MaatruCareDemoContext";
import { useAuth } from "@/context/AuthContext";
import { caregiverLabel, displayTimestamp } from "@/lib/coordination";

const stages = ["Prepared", "Sent", "Acknowledged", "Completed"];
const blank = { title: "", from: "", to: "", reason: "", context: "", relatedTask: "" };
export default function HandoffsPage() {
  const { account } = useAuth();
  const { handoffs, tasks, caregiverRecords, permissions, createHandoff, sendHandoff, acknowledgeHandoff, completeHandoff, removeHandoff, loading, handoffError } = useMaatruCareDemo();
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("All");
  const [createOpen, setCreateOpen] = useState(false);
  const [removing, setRemoving] = useState<DemoHandoff | null>(null);
  const [form, setForm] = useState(blank);
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const controller = account?.role === "patient";
  const canCoordinate = controller || Boolean(account?.caregiver_id && permissions[account.caregiver_id]?.["Care handoffs"]);
  const removed = (item: DemoHandoff) => Boolean(item.archivedAt) || item.stage === "Cancelled";
  const current = handoffs.filter((item) => !removed(item));
  const visible = (filter === "History" ? handoffs.filter(removed) : current.filter((item) => filter === "All" || item.stage === filter)).sort((a,b) => Number(b.id) - Number(a.id));
  const selected = visible.find((item) => item.id === selectedId) ?? visible.find((item) => item.stage !== "Completed") ?? visible[0];
  const own = { id: account?.caregiver_id ?? undefined, name: account?.name ?? "You", relationship: controller ? "Care Circle owner" : account?.caregiver?.relationship ?? "Caregiver", is_demo: false, email: account?.email ?? null };
  const senderOptions = [own, ...caregiverRecords.filter((member) => member.is_demo && controller)];
  const ownerId = account?.patient?.owner_caregiver_id;
  const ownerOption = !controller && ownerId ? [{ id: ownerId, name: account?.patient?.name ?? "Care Circle owner", relationship: "Care Circle owner", is_demo: false, email: null }] : [];
  const recipientOptions = [...caregiverRecords, ...ownerOption].filter((member) => String(member.id) !== form.from);
  const canSend = selected && !removed(selected) && canCoordinate && (selected.fromId === account?.caregiver_id || selected.fromDemo && controller);
  const recipientShared = selected && (!controller || permissions[selected.toId]?.["Care handoffs"] !== false);
  const canRespond = selected && !removed(selected) && canCoordinate && recipientShared && (selected.toId === account?.caregiver_id || selected.toDemo && controller);
  const simulation = Boolean(selected?.toDemo && selected.toId !== account?.caregiver_id);
  const qualifying = current.filter((item) => ["Acknowledged", "Completed"].includes(item.stage) && !item.toDemo && item.sentAt && item.acknowledgedAt && Date.parse(item.acknowledgedAt) >= Date.parse(item.sentAt));
  const average = qualifying.length ? qualifying.reduce((sum, item) => sum + (Date.parse(item.acknowledgedAt!) - Date.parse(item.sentAt!)) / 60000, 0) / qualifying.length : null;
  const count = (number: number) => loading ? "Loading" : handoffError ? "Unavailable" : number;

  async function run(action: () => Promise<unknown>, text: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFeedback({ text: "", error: false });
    try { await action(); setFeedback({ text, error: false }); }
    catch (cause) { setFeedback({ text: cause instanceof Error ? cause.message : "The handoff could not be updated", error: true }); }
    finally { lock.current = false; setBusy(false); }
  }
  function create(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.reason.trim() || !form.from || !form.to || form.from === form.to) {
      setFeedback({ text: "Enter a title, responsibility and two different participants.", error: true }); return;
    }
    void run(async () => {
      const id = await createHandoff({ title: form.title.trim(), reason: form.reason.trim(), fromId: Number(form.from), toId: Number(form.to), context: form.context.trim() || undefined, relatedTaskId: form.relatedTask ? Number(form.relatedTask) : undefined });
      setFilter("All"); setSelectedId(id); setCreateOpen(false);
    }, "Handoff prepared");
  }

  return <AppShell><PageHeading title="Care handoffs" description="Keep each responsibility clear as it passes from one person to another." action={<Button disabled={!canCoordinate || loading || busy} onClick={() => { setFeedback({text:"",error:false}); setForm({ ...blank, from: String(account?.caregiver_id ?? "") }); setCreateOpen(true); }}><Plus size={16} />Create handoff</Button>} />
    <Message error={feedback.error}>{feedback.text}</Message><Message error>{handoffError}</Message>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Total handoffs" value={count(current.length)} detail="Excludes cancelled and archived" /><Stat label="Awaiting acknowledgement" value={count(current.filter((item) => item.stage === "Sent").length)} /><Stat label="Acknowledged" value={count(current.filter((item) => item.stage === "Acknowledged").length)} /><Stat label="Completed" value={count(current.filter((item) => item.stage === "Completed").length)} /></div>
    <div className="mc-tabs" aria-label="Handoff status filters">{["All", ...stages, "History"].map((stage) => <button key={stage} type="button" aria-pressed={filter === stage} onClick={() => setFilter(stage)}>{stage === "Sent" ? "Awaiting acknowledgement" : stage === "History" ? "Cancelled & archived" : stage}</button>)}</div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(220px,0.6fr)_minmax(0,1.4fr)]"><Panel title={filter === "History" ? "Retained history" : "Responsibilities"}>
      {loading ? <p role="status" className="mc-caption">Loading handoffs...</p> : !visible.length ? <div className="py-5"><h3 className="font-semibold">{filter === "History" ? "Nothing removed yet" : "No handoffs in this view"}</h3><p className="mc-caption mt-2">{filter === "History" ? "Cancelled and archived handoffs remain available here." : "Prepare a handoff when someone else needs to take responsibility."}</p></div> : <div className="space-y-3">{visible.map((item) => <button key={item.id} type="button" aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === item.id ? "border-[var(--mc-brand)] bg-[var(--mc-surface-muted)]" : "border-[var(--mc-border)] hover:bg-[var(--mc-surface-muted)]"}`}><span className="block break-words font-semibold">{item.title}</span><span className="mc-caption mt-1 block">To {item.to}</span><span className="mt-3 flex flex-wrap gap-2"><Badge tone={item.stage === "Completed" ? "success" : "neutral"}>{item.archivedAt ? "Archived" : item.stage === "Sent" ? "Awaiting acknowledgement" : item.stage}</Badge>{(item.toDemo || item.fromDemo) && <Badge>Simulated</Badge>}</span></button>)}</div>}
    </Panel>
    {selected ? <Panel title={selected.title} action={<Badge tone={selected.stage === "Completed" ? "success" : "neutral"}>{selected.archivedAt ? "Archived" : selected.stage === "Sent" ? "Awaiting acknowledgement" : selected.stage}</Badge>}>
      <p className="mb-5 whitespace-pre-line text-sm leading-7">{selected.reason}</p>
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-[var(--mc-surface-muted)] p-4"><div><p className="mc-caption">From</p><p className="font-semibold">{selected.from}</p>{selected.fromDemo && <Badge>Simulated</Badge>}</div><ArrowRight size={18} aria-hidden="true" className="text-[var(--mc-muted)]" /><div><p className="mc-caption">To</p><p className="font-semibold">{selected.to}</p>{selected.toDemo && <Badge>Simulated</Badge>}</div></div>
      {selected.context && <div className="mb-5"><h3 className="text-sm font-semibold">Context</h3><p className="mc-caption mt-2 whitespace-pre-line">{selected.context}</p></div>}
      {selected.relatedTaskId && <p className="mc-caption mb-5">Related task: <Link href="/tasks" className="underline">{tasks.find((item) => Number(item.id) === selected.relatedTaskId)?.title ?? "View task"}</Link></p>}
      <ol className="grid grid-cols-2 gap-5 border-y border-[var(--mc-border)] py-6 sm:grid-cols-4" aria-label="Handoff progress">{stages.map((stage,index) => {
        const position = stages.indexOf(selected.stage); const done = index < position || selected.stage === "Completed";
        const timestamp = [selected.createdAt,selected.sentAt,selected.acknowledgedAt,selected.completedAt][index];
        return <li key={stage} aria-current={!removed(selected) && index === position ? "step" : undefined}><span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full border text-sm ${done || removed(selected) && timestamp ? "border-[var(--mc-success)] text-[var(--mc-success)]" : index === position && !removed(selected) ? "border-[var(--mc-brand)] text-[var(--mc-brand)]" : "border-[var(--mc-border)] text-[var(--mc-muted)]"}`}>{done || removed(selected) && timestamp ? <Check size={16} /> : index + 1}</span><p className="text-sm font-semibold">{stage}</p>{timestamp && <time className="mc-caption mt-1 block">{displayTimestamp(timestamp)}</time>}</li>;
      })}</ol>
      {removed(selected) ? <p className="mc-caption mt-5">{selected.archivedAt ? "Archived" : "Cancelled"} {displayTimestamp(selected.archivedAt ?? selected.cancelledAt)}. History is retained.</p> : <div className="mt-6">
        <div className="flex flex-wrap items-center gap-3">{selected.stage === "Prepared" && canSend && <Button disabled={busy} onClick={() => void run(() => sendHandoff(selected.id), "Handoff sent")}>Send handoff</Button>}{selected.stage === "Sent" && canRespond && <Button disabled={busy} onClick={() => void run(() => acknowledgeHandoff(selected.id), simulation ? "Simulated acknowledgement recorded" : "Handoff acknowledged")}>{simulation ? "Acknowledge (simulation)" : "Acknowledge"}</Button>}{selected.stage === "Acknowledged" && canRespond && <Button disabled={busy} onClick={() => void run(() => completeHandoff(selected.id), simulation ? "Simulated completion recorded" : "Handoff completed")}>{simulation ? "Complete (simulation)" : "Complete handoff"}</Button>}{controller && <Button variant="secondary" disabled={busy} onClick={() => setRemoving(selected)}>{selected.stage === "Completed" ? "Archive handoff" : "Cancel handoff"}</Button>}</div>
        {simulation && canRespond && ["Sent","Acknowledged"].includes(selected.stage) && <p className="mc-caption mt-3">Simulated action - no caregiver account is involved.</p>}
        {controller && !recipientShared && ["Prepared","Sent","Acknowledged"].includes(selected.stage) && <p className="mc-caption mt-3">Enable Care handoffs sharing for {selected.to} in <Link href="/consent" className="underline">Consent & sharing</Link> to continue.</p>}
        {!simulation && selected.stage === "Sent" && !canRespond && <p className="mc-caption mt-3">Waiting for {selected.to} to acknowledge.</p>}
      </div>}
    </Panel> : <Panel title="A clear next step"><p className="mc-caption">Choose a handoff to see the responsibility, its progress and the next available action.</p></Panel>}
    </div>
    <p className="mc-caption mt-5">Average real acknowledgement: {average === null ? "Not enough records yet" : average < 1 ? "Under 1 minute" : `${Math.round(average)} minutes`}. <Link href="/timeline" className="underline">View activity</Link></p>
    {createOpen && <Drawer title="Prepare a handoff" onClose={() => { if (!busy) setCreateOpen(false); }}><form onSubmit={create}><fieldset disabled={busy}>
      <Field label="Handoff title"><input required maxLength={255} value={form.title} onChange={(event) => setForm({...form,title:event.target.value})} autoFocus /></Field>
      <Field label="From"><select required value={form.from} onChange={(event) => setForm({...form,from:event.target.value,to:event.target.value===form.to?"":form.to})}>{senderOptions.map((member) => <option key={member.id} value={member.id}>{caregiverLabel(member,caregiverRecords)}</option>)}</select></Field>
      <Field label="Receiving caregiver"><select required value={form.to} onChange={(event) => setForm({...form,to:event.target.value})}><option value="">Choose a caregiver</option>{recipientOptions.map((member) => <option key={member.id} value={member.id} disabled={controller && permissions[member.id]?.["Care handoffs"]===false}>{caregiverLabel(member,caregiverRecords)}{controller && permissions[member.id]?.["Care handoffs"]===false?" - Sharing off":""}</option>)}</select></Field>
      <Field label="Responsibility / reason"><textarea required maxLength={2000} value={form.reason} onChange={(event) => setForm({...form,reason:event.target.value})} /></Field>
      <Field label="Context (optional)"><textarea maxLength={2000} value={form.context} onChange={(event) => setForm({...form,context:event.target.value})} /></Field>
      {tasks.length>0 && <Field label="Related task (optional)"><select value={form.relatedTask} onChange={(event) => setForm({...form,relatedTask:event.target.value})}><option value="">No linked task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></Field>}
      {controller && <p className="mc-caption mb-4">Sharing off? Enable the caregiver&apos;s handoff access in <Link href="/consent" className="underline">Consent & sharing</Link>.</p>}
      <Button type="submit" disabled={busy}>{busy?"Preparing...":"Prepare handoff"}</Button>
    </fieldset><Message error={feedback.error}>{feedback.text}</Message></form></Drawer>}
    {removing && <Drawer title={removing.stage === "Completed" ? "Archive this handoff?" : "Cancel this handoff?"} onClose={() => { if (!busy) setRemoving(null); }}><p className="text-sm leading-7">Remove &quot;{removing.title}&quot; from your active responsibilities? Its history will be retained.</p><div className="mt-6 flex flex-wrap gap-3"><Button variant="secondary" disabled={busy} onClick={() => setRemoving(null)}>Keep handoff</Button><Button variant="danger" disabled={busy} onClick={() => void run(async () => {await removeHandoff(removing.id);setRemoving(null);},removing.stage === "Completed" ? "Handoff archived. Its history is retained." : "Handoff cancelled. Its history is retained.")}>{busy?"Saving...":removing.stage === "Completed"?"Confirm archive":"Confirm cancellation"}</Button></div><Message error={feedback.error}>{feedback.text}</Message></Drawer>}
  </AppShell>;
}
