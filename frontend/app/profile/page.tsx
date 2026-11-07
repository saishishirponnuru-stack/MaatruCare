"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type FormEvent, type ReactNode } from "react";
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
  UserRound,
  Users,
  X,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { useLocalSettings, type DemoProfile } from "@/context/LocalSettingsContext";
import { useMaatruCareDemo } from "@/context/MaatruCareDemoContext";

const phases = [
  { name: "Preconception", state: "Completed", icon: Sprout },
  { name: "Pregnancy", state: "Current phase", icon: CalendarDays },
  { name: "Postnatal", state: "Upcoming", icon: HeartHandshake },
  { name: "Early motherhood", state: "Upcoming", icon: Users },
] as const;

const caregivers = [
  { name: "Rahul Rao", relation: "Partner", role: "Primary caregiver", initials: "RR" },
  { name: "Lakshmi Rao", relation: "Mother", role: "Family caregiver", initials: "LR" },
  { name: "Priya Rao", relation: "Sister", role: "Support caregiver", initials: "PR" },
] as const;

export default function ProfilePage() {
  const { profile, saveProfile: persistProfile } = useLocalSettings();
  const { tasks, handoffs, timeline } = useMaatruCareDemo();
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [form, setForm] = useState<DemoProfile>(profile);
  const [profileError, setProfileError] = useState("");

  function beginEdit() {
    setForm(profile);
    setProfileError("");
    setIsEditing(true);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() };
    if (!next.name || next.name.length > 80) {
      setProfileError("Enter a name of 1 to 80 characters.");
      return;
    }
    if (!/^\+?[0-9 ()-]{7,32}$/.test(next.phone)) {
      setProfileError("Enter a phone number using only digits, spaces, +, parentheses, or hyphens.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email) || next.email.length > 254) {
      setProfileError("Enter a valid email address.");
      return;
    }
    persistProfile(next);
    setIsEditing(false);
    setFeedback(true);
    window.setTimeout(() => setFeedback(false), 2600);
  }

  const profileInitials = profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "MC";
  const openTaskCount = tasks.filter((task) => task.status !== "Completed").length;
  const activeHandoff = handoffs.find((handoff) => handoff.stage !== "Completed");
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
              {profile.name}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">
              Your profile and coordination snapshot.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-[#E9E1E4] bg-white px-3.5 py-2 text-[10px] font-semibold text-[#756D72]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4F8068]" />
              Current phase
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
          Profile edits are stored in this browser only. Do not enter real patient or caregiver information.
        </div>

        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex items-center gap-2 rounded-[12px] border border-[#CFE0D5] bg-[#F1F8F3] px-3 py-2 text-xs font-medium text-[#3F6D56]"
            role="status"
          >
            <Check size={15} />
            Profile details saved in this browser.
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
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#211C1F]">{profile.name}</h2>
                <p className="mt-1 text-xs text-[#756D72]">Care profile · Current phase: Pregnancy</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:min-w-[330px]">
              <ProfileDetail label="Phone · local only" value={profile.phone} />
              <ProfileDetail label="Email · local only" value={profile.email} />
            </div>
          </div>
        </section>

        <section className="mt-8">
          <SectionHeading eyebrow="Care journey phases" title="Motherhood journey" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {phases.map((phase, index) => {
              const Icon = phase.icon;
              const current = phase.name === "Pregnancy";
              return (
                <motion.div
                  key={phase.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className={`rounded-[18px] border p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)] ${current ? "border-[#B98FA5] bg-white ring-2 ring-[#F3EAF0]" : "border-[#E9E1E4] bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${current ? "bg-[#F3EAF0] text-[#6D3A5B]" : phase.state === "Completed" ? "bg-[#EEF5F0] text-[#4F8068]" : "bg-[#FBF8F7] text-[#9A9196]"}`}>
                      <Icon size={17} />
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${current ? "bg-[#F3EAF0] text-[#6D3A5B]" : phase.state === "Completed" ? "bg-[#EEF5F0] text-[#4F8068]" : "bg-[#F5F1F3] text-[#9A9196]"}`}>
                      {phase.state}
                    </span>
                  </div>
                  <h3 className="mt-5 text-sm font-semibold text-[#211C1F]">{phase.name}</h3>
                  <p className="mt-1 text-[10px] leading-4 text-[#756D72]">
                    {current ? "Coordinating ongoing care" : phase.state === "Completed" ? "Planning and preparation" : "Support coordination ahead"}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading eyebrow="Care Circle" title="Care team members" />
            <Link href="/care-circle" className="hidden items-center gap-1.5 text-[11px] font-semibold text-[#6D3A5B] sm:flex">Manage Care Circle <ArrowUpRight size={13} /></Link>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {caregivers.map((caregiver) => (
              <div key={caregiver.name} className="rounded-[18px] border border-[#E9E1E4] bg-white p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0E5EB] text-xs font-semibold text-[#6D3A5B]">{caregiver.initials}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#211C1F]">{caregiver.name}</h3>
                    <p className="mt-1 text-[10px] text-[#9A9196]">{caregiver.relation} · {caregiver.role}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2 rounded-[12px] bg-[#FBF8F7] px-3 py-2.5 text-[10px] leading-4 text-[#756D72]">
                  <ShieldCheck size={14} className="shrink-0 text-[#6D3A5B]" />
                  Access is controlled through your consent.
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <SectionHeading eyebrow="Coordination snapshot" title="Coordination activity" />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <OverviewCard href="/appointments" icon={<CalendarDays size={17} />} label="Appointment planning" title="Coordinate a clinic visit" tone="plum">
              <span>No current appointment is represented here.</span>
              <span className="mt-1 block text-[10px] text-[#9A9196]">Open Appointment details for backend records.</span>
            </OverviewCard>
            <OverviewCard href="/tasks" icon={<FileText size={17} />} label="Open coordination tasks" title={`${openTaskCount} open responsibilities`}>
              <span>Count from coordination tasks currently loaded from the backend.</span>
            </OverviewCard>
            <OverviewCard href="/handoffs" icon={<ArrowRight size={17} />} label="Active care handoff" title={activeHandoff?.title ?? "No active handoff loaded"}>
              <span>{activeHandoff ? <>{activeHandoff.from} <span className="mx-1 text-[#B86B87]">→</span> {activeHandoff.to}</> : "No open handoff is currently loaded from the backend."}</span>
              {activeHandoff && <span className="mt-1 block text-[10px] text-[#9A9196]">Current status: {activeHandoff.stage}</span>}
            </OverviewCard>
            <OverviewCard href="/timeline" icon={<History size={17} />} label="Recent backend activity" title={recentEvents[0]?.title ?? "No timeline events loaded"}>
              <span>{recentEvents[0] ? `${recentEvents[0].eventDate} · ${recentEvents[0].eventType}` : "Open Timeline to review available backend events."}</span>
            </OverviewCard>
          </div>
        </section>

        <section className="mt-8 rounded-[20px] border border-[#E4D7DF] bg-[#F8F2F6] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#EBDCE5] text-[#6D3A5B]"><ShieldCheck size={19} /></div>
              <div>
                <h2 className="text-sm font-semibold text-[#211C1F]">No current care status recorded.</h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-[#756D72]">Backend permission checks apply to coordination endpoints. Profile details are stored in this browser and are not clinician-verified.</p>
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Backend timeline</p>
                <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">Recent coordination events</h2>
              </div>
              <Link href="/timeline" aria-label="View activity timeline" className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F3EAF0] text-[#6D3A5B] transition hover:bg-[#EBDCE5]"><ArrowUpRight size={16} /></Link>
            </div>
            <div className="mt-6 space-y-4">
              {recentEvents.length > 0 ? recentEvents.map((event) => <div key={event.id} className="flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#F3EAF0] text-[#6D3A5B]"><History size={15} /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-[11px] font-semibold text-[#211C1F]">{event.title}</p><span className="shrink-0 text-[9px] text-[#9A9196]">{event.eventDate}</span></div><p className="mt-1 text-[10px] leading-4 text-[#756D72]">{event.description}</p></div></div>) : <p className="text-[11px] text-[#9A9196]">No backend timeline events are currently loaded.</p>}
            </div>
          </section>
        </div>

        <section className="mt-6 flex gap-3 rounded-[16px] bg-[#FBF8F7] p-4">
          <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#6D3A5B]" />
          <p className="text-[11px] leading-5 text-[#756D72]">Profile edits stay in this browser and are not written to a patient record. MaatruCare does not diagnose conditions, interpret clinical results, or make treatment decisions.</p>
        </section>
      </div>

      <AnimatePresence>
        {isEditing && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditing(false)} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" />
            <motion.aside role="dialog" aria-modal="true" aria-labelledby="profile-editor-title" tabIndex={-1} initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[#E9E1E4] bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-[#F0E9EC] px-6 py-5">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Care profile</p><h2 id="profile-editor-title" className="mt-1 text-lg font-semibold text-[#211C1F]">Edit your profile</h2></div>
                <button type="button" aria-label="Close profile editor" onClick={() => setIsEditing(false)} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#9A9196] transition hover:bg-[#FBF8F7] hover:text-[#211C1F]"><X size={18} /></button>
              </div>
              <form onSubmit={saveProfile} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                  <div className="flex items-center gap-3 rounded-[14px] bg-[#F8F2F6] p-4"><UserRound size={18} className="text-[#6D3A5B]" /><p className="text-xs leading-5 text-[#756D72]">These profile details are saved only in this browser. Do not enter real patient or caregiver information.</p></div>
                  <EditField label="Full name" value={form.name} onChange={(value) => { setForm({ ...form, name: value }); setProfileError(""); }} />
                  <EditField label="Phone" type="tel" value={form.phone} onChange={(value) => { setForm({ ...form, phone: value }); setProfileError(""); }} />
                  <EditField label="Email" type="email" value={form.email} onChange={(value) => { setForm({ ...form, email: value }); setProfileError(""); }} />
                  <EditField label="Role" value="Patient" disabled />
                  {profileError && <p role="alert" className="rounded-[12px] border border-[#E7C8CC] bg-[#FFF5F5] p-3 text-xs text-[#9D4B55]">{profileError}</p>}
                </div>
                <div className="flex gap-2 border-t border-[#F0E9EC] p-6"><button type="button" onClick={() => setIsEditing(false)} className="flex-1 rounded-[13px] border border-[#E9E1E4] py-3 text-xs font-semibold text-[#756D72]">Cancel</button><button type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-[13px] bg-[#6D3A5B] py-3 text-xs font-semibold text-white transition hover:bg-[#4D2941]"><Check size={15} />Save locally</button></div>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
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

function EditField({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange?: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-[#756D72]">{label}</span><input type={type} value={value} onChange={(event) => onChange?.(event.target.value)} readOnly={disabled} disabled={disabled} maxLength={type === "email" ? 254 : 80} className="h-11 w-full rounded-[11px] border border-[#E9E1E4] bg-[#FBF8F7] px-3 text-xs font-medium text-[#211C1F] outline-none disabled:text-[#9A9196]" /></label>;
}
