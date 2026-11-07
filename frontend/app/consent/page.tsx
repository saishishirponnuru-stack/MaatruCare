"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { Badge, Message, PageHeading, Panel, Stat } from "@/components/ui/ProductUI";
import { useMaatruCareDemo, type PermissionName } from "@/context/MaatruCareDemoContext";
import { useAuth } from "@/context/AuthContext";
import { displayTimestamp } from "@/lib/coordination";

const categories: { name: PermissionName; description: string }[] = [
  { name: "Appointments", description: "Visit details, dates and appointment coordination." },
  { name: "Coordination tasks", description: "Shared responsibilities, assignment and task progress." },
  { name: "Care handoffs", description: "Responsibility transfers and acknowledgements." },
  { name: "Approved care updates", description: "Coordination history and updates you choose to share." },
];
function accessLabel(count: number) { return count === 4 ? "Full sharing access" : count === 0 ? "Sharing off" : `${count} of 4 categories enabled`; }

export default function ConsentPage() {
  const { account } = useAuth();
  const { caregiverRecords, permissions, updateConsentPermission, consentHistory, loading, error } = useMaatruCareDemo();
  const canManage = account?.role === "patient";
  const members = canManage ? caregiverRecords : caregiverRecords.filter((member) => member.id === account?.caregiver_id);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = members.find((member) => member.id === selectedId) ?? members[0];
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const count = (id: number) => categories.filter(({ name }) => permissions[id]?.[name]).length;
  async function toggle(name: PermissionName) {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true);
    try { await updateConsentPermission(selected.id, name, !permissions[selected.id]?.[name]); setFeedback({ text: "Permissions saved", error: false }); }
    catch (cause) { setFeedback({ text: cause instanceof Error ? cause.message : "Permissions could not be saved", error: true }); }
    finally { lock.current = false; setBusy(false); }
  }
  return <AppShell><PageHeading title="Consent & sharing" description={canManage ? "Choose what each caregiver can access. You can change sharing at any time." : "Review what the Care Circle owner has shared with you."} />
    <Message error={feedback.error}>{feedback.text}</Message>{error && <Message error>{error}</Message>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat label="Caregivers" value={members.length} /><Stat label="Full sharing" value={members.filter((member) => count(member.id) === 4).length} /><Stat label="Limited or off" value={members.filter((member) => count(member.id) < 4).length} /></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(240px,0.65fr)_minmax(0,1.35fr)]"><Panel title="Your Care Circle">{loading ? <p role="status" className="mc-caption">Loading sharing settings...</p> : members.length ? <div className="space-y-2">{members.map((member) => <button type="button" key={member.id} onClick={() => setSelectedId(member.id)} aria-pressed={selected?.id === member.id} className={`w-full rounded-xl border p-4 text-left ${selected?.id === member.id ? "border-[var(--mc-brand)] bg-[var(--mc-surface-muted)]" : "border-[var(--mc-border)]"}`}><span className="font-semibold">{member.name}</span><span className="mc-caption mt-1 block">{member.relationship}</span><span className="mc-caption mt-2 block">{accessLabel(count(member.id))}</span>{member.is_demo && <Badge>Simulated</Badge>}</button>)}</div> : <p className="mc-caption">{canManage ? <>Invite someone in <Link className="underline" href="/care-circle">Care Circle</Link> to begin sharing.</> : "No sharing categories are available for this account."}</p>}</Panel>
      <Panel title={selected ? `Sharing with ${selected.name}` : "Sharing categories"} description={selected ? accessLabel(count(selected.id)) : "Select a caregiver to review access."}>{selected && <div className="divide-y divide-[var(--mc-border)]">{categories.map(({ name, description }) => { const enabled = permissions[selected.id]?.[name] ?? false; return <div key={name} className="flex items-center gap-5 py-5 first:pt-0"><div className="flex-1"><h3 className="text-sm font-semibold">{name}</h3><p className="mc-caption mt-1">{description}</p></div><button type="button" role="switch" aria-label={`${name} for ${selected.name}`} aria-checked={enabled} disabled={busy || !canManage || loading} onClick={() => void toggle(name)} className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-55 ${enabled ? "bg-[var(--mc-brand)]" : "bg-[var(--mc-border)]"}`}><span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : ""}`} /></button></div>; })}</div>}</Panel></div>
    <Panel title="Recent sharing changes" className="mt-5" description="Changes are retained for accountability." action={consentHistory.length > 6 && <button type="button" className="mc-caption underline" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer" : "Show recent history"}</button>}>
      {consentHistory.length ? <ol className="divide-y divide-[var(--mc-border)]">{consentHistory.slice(0, expanded ? 20 : 6).map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3"><div><p className="text-sm"><strong>{caregiverRecords.find((member) => member.id === item.caregiver_id)?.name ?? "Former caregiver"}</strong> - {item.permission_name} {item.action === "granted" ? "enabled" : "disabled"}</p></div><time className="mc-caption">{displayTimestamp(item.created_at)}</time></li>)}</ol> : <p className="mc-caption">Sharing changes will appear here.</p>}
    </Panel><p className="mc-caption mt-5">To revoke all access, <Link href="/care-circle" className="underline">remove the caregiver from Care Circle</Link>. Their history is retained.</p>
  </AppShell>;
}
