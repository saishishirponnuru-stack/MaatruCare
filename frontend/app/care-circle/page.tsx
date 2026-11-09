"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { MoreHorizontal, Plus, UserPlus } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge, Button, Drawer, Field, Message, PageHeading, Panel } from "@/components/ui/ProductUI";
import { api, type ApiCaregiver, type ApiCaregiverInvitation } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMaatruCareDemo, type PermissionName } from "@/context/MaatruCareDemoContext";
import { displayTimestamp } from "@/lib/coordination";

const categories: PermissionName[] = ["Appointments", "Coordination tasks", "Care handoffs", "Approved care updates"];
const relationships = ["Partner", "Parent", "Brother", "Sister", "Cousin", "Friend", "Family caregiver", "Support caregiver"];
const simulatedEnabled = process.env.NEXT_PUBLIC_DEMO_CAREGIVERS_ENABLED === "true";

export default function CareCirclePage() {
  const { account } = useAuth();
  const { caregiverRecords, permissions, updateConsentPermission, removeCaregiver, refreshData, loading, error } = useMaatruCareDemo();
  const canManage = account?.role === "patient";
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<"invite" | "simulated" | null>(null);
  const [invitations, setInvitations] = useState<ApiCaregiverInvitation[]>([]);
  const [delivery, setDelivery] = useState({ email_available: false, simulated_available: false, explanation: "Create and securely share an invitation link." });
  const [inviteLoading, setInviteLoading] = useState(true);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [relationship, setRelationship] = useState("Partner");
  const [editName, setEditName] = useState(""); const [editRelationship, setEditRelationship] = useState("");
  const [invitationLink, setInvitationLink] = useState("");
  const [invitationId,setInvitationId]=useState<number|null>(null);
  const [emailStatus,setEmailStatus]=useState<ApiCaregiverInvitation["email_status"]>("not_requested");
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const selected = caregiverRecords.find((member) => member.id === selectedId);
  const pending = invitations.filter((item) => item.status === "Pending");
  const loadInvitations = useCallback(async () => {
    if (!canManage || !account?.patient_id || !account.caregiver_id) { setInviteLoading(false); return false; }
    setInviteLoading(true);
    try { const [items, capability] = await Promise.all([api.getCaregiverInvitations({ patientId: account.patient_id, caregiverId: account.caregiver_id }), api.invitationDelivery()]); setInvitations(items); setDelivery(capability); return true; }
    catch (cause) { setFeedback({ text: cause instanceof Error ? cause.message : "Invitations could not be loaded", error: true }); return false; }
    finally { setInviteLoading(false); }
  }, [account, canManage]);
  useEffect(() => { const timer = window.setTimeout(() => void loadInvitations(), 0); return () => window.clearTimeout(timer); }, [loadInvitations]);
  async function run(action: () => Promise<unknown>, text: string) {
    if (lock.current) return; lock.current = true; setBusy(true); setFeedback({ text: "", error: false });
    try { const result = await action(); setFeedback({ text: typeof result === "string" ? result : text, error: false }); }
    catch (cause) { setFeedback({ text: cause instanceof Error ? cause.message : "The change could not be saved", error: true }); }
    finally { lock.current = false; setBusy(false); }
  }
  function select(member: ApiCaregiver) { setSelectedId(member.id); setEditName(member.name); setEditRelationship(member.relationship); }
  function add(event: FormEvent) {
    event.preventDefault();
    const sendEmail = (event.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement && ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement).value === "email";
    if (!account?.patient_id || !account.caregiver_id || !name.trim()) return;
    void run(async () => {
      if (mode === "simulated") {
        await api.createDemoCaregiver({ patient_id: account.patient_id!, actor_caregiver_id: account.caregiver_id!, name: name.trim(), relationship, role: "Support caregiver", coordination_access: true });
        await refreshData(); setMode(null);
      } else {
        const result = await api.createCaregiverInvitation({ name: name.trim(), email: email.trim(), relationship, delivery: sendEmail ? "email" : "link" });
        setInvitationLink(`${window.location.origin}/onboarding?role=caregiver&invitation=${encodeURIComponent(result.token)}`);
        setInvitationId(result.id??null);setEmailStatus(result.email_status);
        await loadInvitations();
        if (result.email_status === "accepted") return "Invitation email accepted for delivery.";
        if (sendEmail) throw new Error("Email delivery was not confirmed. Your invitation link is ready to copy and share securely.");
        return "Invitation link ready. Share it securely.";
      }
      setName(""); setEmail("");
    }, mode === "simulated" ? "Simulated caregiver added. Task and handoff sharing are enabled; you can change them anytime." : "Invitation ready. Share the secure link with your caregiver.");
  }
  const message = <Message error={feedback.error}>{feedback.text}</Message>;
  return <AppShell><PageHeading title="People you trust" description="Invite your care circle and choose how each person can help." action={canManage && <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => { setInvitationLink(""); setMode("invite"); }}><UserPlus size={16} />Invite caregiver</Button>{simulatedEnabled && delivery.simulated_available && <Button variant="secondary" disabled={busy} onClick={() => { setInvitationLink(""); setMode("simulated"); }}><Plus size={16} />Add simulated caregiver</Button>}</div>} />
    {!mode && !selected && message}{error && <Message error>{error}</Message>}
    <section aria-label="Care journey identity" className="mb-5 rounded-[18px] border border-[var(--mc-border)] bg-[var(--mc-surface)] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mc-muted)]">Care journey</p>
      <h2 className="mt-2 text-xl font-semibold text-[var(--mc-text)]">{account?.patient?.name?.trim() || "Mother's name not available"}</h2>
      <p className="mc-caption mt-1">Mother / care recipient</p>
      <div className="mt-4 border-t border-[var(--mc-border)] pt-3">
        <p className="text-xs font-semibold">Workspace access</p>
        <p className="mc-caption mt-1">{account?.role === "patient" ? `Managed by ${account.name} (workspace owner)` : "Managed by the care workspace owner. Your access follows the mother's approved sharing permissions."}</p>
      </div>
    </section>
    <Panel title="Your Care Circle" description={`${caregiverRecords.length} active caregiver${caregiverRecords.length === 1 ? "" : "s"}`} action={<Link href="/consent" className="mc-caption text-[var(--mc-brand)] underline">Manage sharing</Link>}>
      {loading ? <p role="status" className="mc-caption">Loading Care Circle...</p> : !caregiverRecords.length ? <div className="py-8"><h3 className="font-semibold">Bring your trusted people together</h3><p className="mc-caption mt-2">Invite someone to help with appointments, responsibilities or handoffs. Access starts only after they accept and you enable sharing.</p></div> : <div className="grid gap-3 md:grid-cols-2">{caregiverRecords.map((member) => <article key={member.id} className="relative flex items-center gap-3 rounded-2xl border border-[var(--mc-border)] p-4"><button type="button" className="absolute inset-0 rounded-2xl" aria-label={`Manage ${member.name}, ${member.relationship}`} onClick={() => select(member)} /><div className="pointer-events-none relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--mc-surface-muted)] font-semibold text-[var(--mc-brand)]">{member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</div><div className="pointer-events-none relative min-w-0 flex-1"><h3 className="break-words font-semibold">{member.name}</h3><p className="mc-caption">{member.relationship}</p><div className="mt-2 flex gap-2"><Badge tone="success">Active</Badge>{member.is_demo && <Badge>Simulated</Badge>}</div></div><button type="button" className="mc-icon-button relative" aria-label={`More options for ${member.name}`} onClick={() => select(member)}><MoreHorizontal size={18} /></button></article>)}</div>}
    </Panel>
    {canManage && <Panel title="Pending invitations" description={delivery.email_available ? "Invitations expire after seven days. Email acceptance does not confirm that an invitation has been opened." : "Invitations expire after seven days. Email delivery is unavailable; share your secure link directly."} className="mt-5" action={<Button variant="secondary" disabled={busy||inviteLoading||loading} onClick={()=>void run(async()=>{const [invites,team]=await Promise.all([loadInvitations(),refreshData()]);if(!invites||!team)throw new Error("Some Care Circle records could not be refreshed. Try again.");},"Care Circle refreshed")}>Refresh Care Circle</Button>}>{inviteLoading ? <p role="status" className="mc-caption">Loading invitations...</p> : pending.length ? <div className="divide-y divide-[var(--mc-border)]">{pending.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{item.name || item.email}</p><p className="mc-caption break-all">{item.email} - {item.relationship}</p><p className="mc-caption">Expires {displayTimestamp(item.expires_at)}</p><p className="mc-caption">{item.email_status === "accepted" ? "Email accepted for delivery" : item.email_status === "failed" || item.email_status === "unavailable" ? "Email not confirmed; share a secure link" : "Secure link invitation"}</p></div><Button variant="secondary" disabled={busy} onClick={() => { if (window.confirm(`Withdraw the invitation for ${item.email}? It can no longer be accepted.`)) void run(async () => { await api.withdrawCaregiverInvitation(item.id); setInvitations((current) => current.filter((entry) => entry.id !== item.id)); }, "Invitation withdrawn"); }}>Withdraw invitation</Button></div>)}</div> : <p className="mc-caption">No pending invitations.</p>}</Panel>}

    {mode && <Drawer title={mode === "invite" ? "Invite a caregiver" : "Add simulated caregiver"} onClose={() => { if (!busy) setMode(null); }}><form onSubmit={add}><p className="mc-caption mb-4">{mode === "simulated" ? "Fictional caregivers have no sign-in account. Adding one enables task and handoff sharing, which you can change anytime." : delivery.explanation}</p><fieldset disabled={busy}><Field label="Name"><input required value={name} maxLength={200} onChange={(event) => setName(event.target.value)} autoFocus /></Field>{mode === "invite" && <Field label="Email"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>}<Field label="Relationship"><select value={relationship} onChange={(event) => setRelationship(event.target.value)}>{relationships.map((value) => <option key={value}>{value}</option>)}</select></Field>{mode === "invite" && delivery.email_available && <Button type="submit" value="email" disabled={busy}>{busy ? "Saving..." : "Send invitation"}</Button>}<Button type="submit" value="link" variant={mode === "invite" && delivery.email_available ? "secondary" : "primary"} className="mt-2" disabled={busy}>{busy ? "Saving..." : mode === "invite" ? "Create invitation link" : "Add simulated caregiver"}</Button></fieldset></form>{invitationLink && <div className="mt-5"><Field label="Secure invitation link"><textarea readOnly value={invitationLink} /></Field><Button variant="secondary" onClick={() => void run(() => navigator.clipboard.writeText(invitationLink), "Invitation link copied. Share it directly with your caregiver.")}>Copy invitation link</Button>{delivery.email_available&&invitationId&&emailStatus!=="accepted"&&<Button variant="secondary" className="ml-2" disabled={busy} onClick={()=>void run(async()=>{const token=new URL(invitationLink).searchParams.get("invitation");if(!token)throw new Error("The secure invitation link is unavailable.");const result=await api.retryInvitationEmail(invitationId,token);setEmailStatus(result.email_status);if(result.email_status!=="accepted")throw new Error("Email delivery was not confirmed. Copy and share your existing secure link.");await loadInvitations();},"Invitation email accepted for delivery.")}>{emailStatus==="not_requested"?"Send invitation email":"Retry invitation email"}</Button>}</div>}{message}</Drawer>}
    {selected && <Drawer title={selected.name} onClose={() => { if (!busy) setSelectedId(null); }}><div className="mb-5 flex gap-2"><Badge>{selected.relationship}</Badge>{selected.is_demo && <Badge>Simulated</Badge>}</div><h3 className="mb-4 font-semibold">Sharing categories</h3>{(canManage || selected.id === account?.caregiver_id) ? categories.map((category) => { const enabled = permissions[selected.id]?.[category] ?? false; return <div key={category} className="mb-4 flex items-center justify-between gap-3"><span className="text-sm">{category}</span><button type="button" role="switch" aria-label={`${category} for ${selected.name}`} aria-checked={enabled} disabled={busy || !canManage} onClick={() => void run(() => updateConsentPermission(selected.id, category, !enabled), "Permissions saved")} className={`relative h-7 w-12 rounded-full transition disabled:opacity-50 ${enabled ? "bg-[var(--mc-brand)]" : "bg-[var(--mc-border)]"}`}><span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : ""}`} /></button></div>; }) : <p className="mc-caption">Sharing details are visible to the Care Circle owner and this caregiver.</p>}{canManage && <><form className="mt-6 border-t border-[var(--mc-border)] pt-5" onSubmit={(event) => { event.preventDefault(); void run(async () => { await api.updateCaregiver(selected.id, { name: editName, relationship: editRelationship, actor_caregiver_id: account!.caregiver_id! }); await refreshData(); }, "Caregiver details saved"); }}><Field label="Display name"><input required value={editName} onChange={(event) => setEditName(event.target.value)} /></Field><Field label="Relationship"><input required maxLength={100} value={editRelationship} onChange={(event) => setEditRelationship(event.target.value)} /></Field><Button type="submit" variant="secondary" disabled={busy}>Save details</Button></form><Button variant="danger" className="mt-5" disabled={busy} onClick={() => { if (window.confirm(`Remove ${selected.name} from your Care Circle? Their access will be revoked; history will remain.`)) void run(async () => { await removeCaregiver(selected.id); setSelectedId(null); }, "Caregiver access revoked"); }}>Remove caregiver</Button></>}{message}</Drawer>}
  </AppShell>;
}
