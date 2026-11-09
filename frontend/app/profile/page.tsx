"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  HeartHandshake,
  History,
  Info,
  Pencil,
  ShieldCheck,
  Sprout,
  Users,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button, Drawer, Field, Message } from "@/components/ui/ProductUI";
import { useLocalSettings, type DemoProfile } from "@/context/LocalSettingsContext";
import { useMaatruCareDemo } from "@/context/MaatruCareDemoContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const phaseNames = ["Preconception", "Pregnancy", "Postnatal", "Early motherhood"] as const;

export default function ProfilePage() {
  const { profile, saveProfile: persistProfile } = useLocalSettings();
  const { account, email, refreshAccount } = useAuth();
  const { tasks, handoffs, timeline, caregiverRecords } = useMaatruCareDemo();
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [form, setForm] = useState<DemoProfile>(profile);
  const [profileError, setProfileError] = useState("");
  const displayName = account?.name?.trim() || "Your profile";
  const currentPhase = account?.patient?.current_phase?.trim() || "Not set";

  function beginEdit() {
    setForm({ ...profile, name: displayName, phone: account?.phone ?? "", email: email ?? "" });
    setProfileError("");
    setIsEditing(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const next = { name: form.name.trim(), phone: form.phone.trim(), email: email ?? "" };
    if (!next.name || next.name.length > 80) {
      setProfileError("Enter a name of 1 to 80 characters.");
      return;
    }
    if (next.phone && !/^\+?[0-9 ()-]{7,32}$/.test(next.phone)) {
      setProfileError("Enter a phone number using only digits, spaces, +, parentheses, or hyphens.");
      return;
    }
    savingRef.current = true; setSaving(true);
    try {
      await api.updateProfile({ name: next.name, phone: next.phone });
      persistProfile({ ...profile, phone: next.phone, email: next.email });
      await refreshAccount();
      setIsEditing(false);
      setFeedback(true);
      window.setTimeout(() => setFeedback(false), 2600);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally { savingRef.current = false; setSaving(false); }
  }

  const profileInitials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "MC";
  const openTaskCount = tasks.filter((task) => task.status !== "Completed").length;
  const activeHandoff = handoffs.find((handoff) => handoff.stage !== "Completed" && handoff.stage !== "Cancelled" && !handoff.archivedAt);
  const recentEvents = timeline.slice(0, 3);

  return (
    <AppShell>
      <div>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
              Care profile
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">
              {displayName}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">
              Your profile and coordination snapshot. Care journey: {account?.patient?.name?.trim() || "Mother's name not available"}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-[#E9E1E4] bg-white px-3.5 py-2 text-[10px] font-semibold text-[#756D72]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4F8068]" />
              Current phase: {currentPhase}
            </span>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={beginEdit}
              className="flex items-center gap-2 rounded-[13px] bg-[#6D3A5B] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#4D2941]"
            >
              <Pencil size={14} />
              Edit profile
            </motion.button>
          </div>
        </div>

        <div role="note" className="mt-5 rounded-[14px] border border-[#E4D7DF] bg-[#F8F2F6] px-4 py-3 text-xs leading-5 text-[#756D72]">
          Your name is stored in your authenticated MaatruCare account. Your phone number is saved to your account. Display preferences stay in this browser.
        </div>

        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex items-center gap-2 rounded-[12px] border border-[#CFE0D5] bg-[#F1F8F3] px-3 py-2 text-xs font-medium text-[#3F6D56]"
            role="status"
          >
            <Check size={15} />
            Account name saved to your MaatruCare profile.
          </motion.div>
        )}

        <section className="mt-8 rounded-[22px] border border-[#E4D7DF] bg-[#F8F2F6] p-6 shadow-[0_8px_30px_rgba(33,28,31,0.025)] sm:p-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-[#E8D7E0] text-2xl font-semibold text-[#6D3A5B] shadow-sm">
                  {profileInitials}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Profile overview</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#211C1F]">{displayName}</h2>
                <p className="mt-1 text-xs text-[#756D72]">Care profile · Current phase: {currentPhase}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:min-w-[330px]">
              <ProfileDetail label="Phone" value={account?.phone || "Not provided"} />
              <ProfileDetail label="Sign-in email" value={email || "Not available"} />
            </div>
          </div>
        </section>

        <section className="mt-8">
          <SectionHeading eyebrow="Care journey phases" title="Motherhood journey" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {phaseNames.map((name, index) => {
              const Icon = [Sprout, CalendarDays, HeartHandshake, Users][index];
              const current = name.toLowerCase() === currentPhase.toLowerCase();
              return (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className={`rounded-[18px] border p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)] ${current ? "border-[#B98FA5] bg-white ring-2 ring-[#F3EAF0]" : "border-[#E9E1E4] bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${current ? "bg-[#F3EAF0] text-[#6D3A5B]" : "bg-[#FBF8F7] text-[#9A9196]"}`}>
                      <Icon size={17} />
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${current ? "bg-[#F3EAF0] text-[#6D3A5B]" : "bg-[#F5F1F3] text-[#9A9196]"}`}>
                      {current ? "Current phase" : "Phase overview"}
                    </span>
                  </div>
                  <h3 className="mt-5 text-sm font-semibold text-[#211C1F]">{name}</h3>
                  <p className="mt-1 text-[10px] leading-4 text-[#756D72]">
                    {current ? "Account-reported current phase" : "Phase overview; no progress status recorded"}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading eyebrow="Care Circle" title="Care team members" />
            <Link href="/care-circle" className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6D3A5B]">Manage Care Circle <ArrowUpRight size={13} /></Link>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {caregiverRecords.map((caregiver) => (
              <div key={caregiver.id} className="rounded-[18px] border border-[#E9E1E4] bg-white p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0E5EB] text-xs font-semibold text-[#6D3A5B]">{caregiver.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#211C1F]">{caregiver.name}</h3>
                    <p className="mt-1 text-[10px] text-[#9A9196]">{caregiver.relationship} · {caregiver.role}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2 rounded-[12px] bg-[#FBF8F7] px-3 py-2.5 text-[10px] leading-4 text-[#756D72]">
                  <ShieldCheck size={14} className="shrink-0 text-[#6D3A5B]" />
                  {caregiver.is_demo ? "Simulated participant" : "Access is controlled through your consent."}
                </div>
              </div>
            ))}
            {caregiverRecords.length === 0 && <div className="rounded-[18px] border border-dashed border-[#E9E1E4] bg-white p-5 text-xs text-[#756D72]">No Care Circle records are currently loaded.</div>}
          </div>
        </section>

        <section className="mt-8">
          <SectionHeading eyebrow="Coordination snapshot" title="Coordination activity" />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <OverviewCard href="/appointments" icon={<CalendarDays size={17} />} label="Appointment planning" title="Coordinate a clinic visit" tone="plum">
              <span>No current appointment is represented here.</span>
              <span className="mt-1 block text-[10px] text-[#9A9196]">View your saved appointments.</span>
            </OverviewCard>
            <OverviewCard href="/tasks" icon={<FileText size={17} />} label="Open coordination tasks" title={`${openTaskCount} open responsibilities`}>
              <span>Your currently open responsibilities.</span>
            </OverviewCard>
            <OverviewCard href="/handoffs" icon={<ArrowRight size={17} />} label="Active care handoff" title={activeHandoff?.title ?? "No active handoff loaded"}>
              <span>{activeHandoff ? <>{activeHandoff.from} <span className="mx-1 text-[#B86B87]">→</span> {activeHandoff.to}</> : "No open handoff."}</span>
              {activeHandoff && <span className="mt-1 block text-[10px] text-[#9A9196]">Current status: {activeHandoff.stage}</span>}
            </OverviewCard>
            <OverviewCard href="/timeline" icon={<History size={17} />} label="Recent activity" title={recentEvents[0]?.title ?? "No timeline events loaded"}>
              <span>{recentEvents[0] ? `${recentEvents[0].eventDate} · ${recentEvents[0].eventType}` : "Open Timeline to review coordination history."}</span>
            </OverviewCard>
          </div>
        </section>

        <section className="mt-8 rounded-[20px] border border-[#E4D7DF] bg-[#F8F2F6] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#EBDCE5] text-[#6D3A5B]"><ShieldCheck size={19} /></div>
              <div>
                <h2 className="text-sm font-semibold text-[#211C1F]">No current care status recorded.</h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-[#756D72]">You control who can access your care information. Profile details are entered by you.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
              <Link href="/consent" className="flex items-center justify-center gap-2 rounded-[12px] border border-[#D8C5D0] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#6D3A5B] transition hover:bg-[#F3EAF0]">Consent <ChevronRight size={14} /></Link>
              <Link href="/timeline" className="flex items-center justify-center gap-2 rounded-[12px] border border-[#D8C5D0] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#6D3A5B] transition hover:bg-[#F3EAF0]">Timeline <ChevronRight size={14} /></Link>
              <Link href="/care-circle" className="flex items-center justify-center gap-2 rounded-[12px] border border-[#D8C5D0] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#6D3A5B] transition hover:bg-[#F3EAF0]">Care Circle <ChevronRight size={14} /></Link>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[22px] border border-[#E9E1E4] bg-white p-6 shadow-[0_8px_30px_rgba(33,28,31,0.035)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Care status</p>
                <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">No clinician-verified status</h2>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F7F3F5] text-[#9A9196]"><Info size={17} /></div>
            </div>
            <div className="mt-6 rounded-[17px] border border-[#E9E1E4] bg-[#FBF8F7] p-4">
              <div className="flex items-start gap-3">
                <Info size={17} className="mt-0.5 shrink-0 text-[#9A9196]" />
                <div>
                  <p className="text-[13px] font-semibold text-[#211C1F]">No current update</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#756D72]">No clinical status or care-team verification is stored in this profile.</p>
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <StatusRow label="Source" value="No source record" />
              <StatusRow label="Status" value="Not verified" />
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E9E1E4] bg-white p-6 shadow-[0_8px_30px_rgba(33,28,31,0.035)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Coordination timeline</p>
                <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">Recent coordination events</h2>
              </div>
              <Link href="/timeline" aria-label="View activity timeline" className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F3EAF0] text-[#6D3A5B] transition hover:bg-[#EBDCE5]"><ArrowUpRight size={16} /></Link>
            </div>
            <div className="mt-6 space-y-4">
              {recentEvents.length > 0 ? recentEvents.map((event) => <div key={event.id} className="flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#F3EAF0] text-[#6D3A5B]"><History size={15} /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-[11px] font-semibold text-[#211C1F]">{event.title}</p><span className="shrink-0 text-[9px] text-[#9A9196]">{event.eventDate}</span></div><p className="mt-1 text-[10px] leading-4 text-[#756D72]">{event.description}</p></div></div>) : <p className="text-[11px] text-[#9A9196]">No coordination history is available yet.</p>}
            </div>
          </section>
        </div>

        <section className="mt-6 flex gap-3 rounded-[16px] bg-[#FBF8F7] p-4">
          <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#6D3A5B]" />
          <p className="text-[11px] leading-5 text-[#756D72]">          Your name and phone are saved to your account. Display preferences stay in this browser. MaatruCare does not diagnose conditions, interpret clinical results, or make treatment decisions.</p>
        </section>
      </div>

      {isEditing && <Drawer title="Edit your profile" onClose={() => { if (!saving) setIsEditing(false); }}>
        <form onSubmit={saveProfile}><fieldset disabled={saving}>
          <p className="mc-caption mb-5">Your name and phone are saved to your account. Your identity provider manages your sign-in email.</p>
          <Field label="Full name"><input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus /></Field>
          <Field label="Phone (optional)"><input type="tel" maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label="Sign-in email"><input readOnly value={email ?? "Not available"} /></Field>
          <p className="mc-caption mb-5">Role: {account?.role === "patient" ? "Care Circle owner" : "Caregiver"}</p>
          <Message error>{profileError}</Message><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
        </fieldset></form>
      </Drawer>}
    </AppShell>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">{eyebrow}</p><h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">{title}</h2></div>;
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return <div className="mc-profile-detail rounded-[14px] border p-3"><p className="mc-profile-detail-label text-[9px] font-semibold uppercase tracking-[0.1em]">{label}</p><p className="mc-profile-detail-value mt-1.5 break-words text-xs font-medium">{value}</p></div>;
}

function OverviewCard({ href, icon, label, title, children, tone = "neutral" }: { href: string; icon: ReactNode; label: string; title: string; children: ReactNode; tone?: "neutral" | "plum" }) {
  return <Link href={href} className={`group rounded-[18px] border p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)] transition hover:-translate-y-0.5 hover:border-[#D7C2CD] ${tone === "plum" ? "border-[#E4D7DF] bg-[#F8F2F6]" : "border-[#E9E1E4] bg-white"}`}><div className="flex items-start justify-between gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${tone === "plum" ? "bg-[#EBDCE5] text-[#6D3A5B]" : "bg-[#FBF8F7] text-[#6D3A5B]"}`}>{icon}</div><ArrowUpRight size={15} className="text-[#B1A6AB] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#6D3A5B]" /></div><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">{label}</p><h3 className="mt-1 text-sm font-semibold text-[#211C1F]">{title}</h3><div className="mt-2 text-[11px] leading-5 text-[#756D72]">{children}</div></Link>;
}

function StatusRow({ label, value, verified = false }: { label: string; value: string; verified?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[10px] text-[#9A9196]">{label}</span><span className={`flex items-center gap-1.5 text-[10px] font-medium ${verified ? "text-[#4F8068]" : "text-[#211C1F]"}`}>{verified && <ShieldCheck size={12} />}{value}</span></div>;
}
