"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Accessibility,
  Bell,
  ChevronRight,
  Eye,
  FileText,
  Globe2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UserRoundPen,
  RotateCcw,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { useLocalSettings, type CarePreferences, type NotificationPreferences } from "@/context/LocalSettingsContext";
import { usePreferences } from "@/context/PreferencesContext";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type NotificationKey = keyof NotificationPreferences;
type CarePreferenceKey = keyof CarePreferences;

const notificationItems: Array<{
  key: NotificationKey;
  title: string;
  description: string;
}> = [
  { key: "appointmentReminders", title: "Appointment reminders", description: "Preference for a future reminder before a visit." },
  { key: "taskReminders", title: "Task reminders", description: "Preference for future coordination reminders." },
  { key: "handoffNotifications", title: "Care handoff updates", description: "Preference for future handoff status updates." },
  { key: "careCircleActivity", title: "Care Circle activity", description: "Preference for future activity updates." },
];

const carePreferenceItems: Array<{
  key: CarePreferenceKey;
  label: string;
  options: readonly string[];
}> = [
  { key: "preferredLanguage", label: "Preferred language for future coordination", options: ["English", "Hindi", "Tamil"] },
  { key: "communicationPreference", label: "Preferred communication channel", options: ["Email", "Text message", "Email and text message"] },
  { key: "caregiverUpdates", label: "Caregiver update preference", options: ["Only approved updates", "All coordination updates", "No caregiver updates"] },
  { key: "appointmentReminders", label: "Appointment reminder preference", options: ["One day before", "Two days before", "One week before"] },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "MC";
}

export default function SettingsPage() {
  const { account, email, signOut, sendPasswordReset } = useAuth();
  const [accountMessage, setAccountMessage] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetSucceeded, setResetSucceeded] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetPreferences, setResetPreferences] = useState(false);
  const [resetPreview, setResetPreview] = useState<{ enabled: boolean; counts: Record<string, number>; explanation: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (!account?.patient_id || !account.caregiver_id) return;
    const timer = window.setTimeout(() => {
      void api.previewLifestyleReset({ patientId: account.patient_id!, caregiverId: account.caregiver_id! }, resetPreferences)
        .then((preview) => { if (active) setResetPreview(preview); })
        .catch(() => { if (active) setResetPreview({ enabled: false, counts: {}, explanation: "Lifestyle reset is unavailable for this account. Your records are preserved." }); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [account?.patient_id, account?.caregiver_id, resetPreferences]);
  const { profile, carePreferences, notifications, updateCarePreference, toggleNotification } = useLocalSettings();
  const {
    theme,
    toggleTheme,
    largerText,
    setLargerText,
    highContrast,
    setHighContrast,
    reducedMotion,
    setReducedMotion,
  } = usePreferences();

  function setCarePreference(key: CarePreferenceKey, value: string) {
    updateCarePreference(key, value as CarePreferences[typeof key]);
  }

  async function resetLifestyle() {
    if (resetting || !resetPreview?.enabled) return;
    const deletionList = Object.entries(resetPreview.counts).map(([label, count]) => `${label.replaceAll("_", " ")}: ${count}`).join(", ");
    if (!window.confirm(`Delete these records from your demonstration workspace: ${deletionList}? Plans, routines, care records and authentication accounts will be preserved.`)) return;
    setResetMessage("");
    setResetSucceeded(false);
    setResetting(true);
    try {
      if (!account?.patient_id || !account.caregiver_id) throw new Error("Finish setting up your care workspace to continue.");
      const result = await api.resetLifestyle({ patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id, reset_preferences: resetPreferences, confirmed: true, expected_counts: resetPreview.counts });
      setResetSucceeded(true);
      setResetMessage(`Reset confirmed by the backend. ${Object.values(result.deleted).reduce((sum, count) => sum + count, 0)} Lifestyle record(s) removed.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Lifestyle reset could not be completed.";
      setResetMessage(detail === "Demo reset is disabled"
        ? "Reset is currently unavailable. A server administrator must enable it before use."
        : detail);
    } finally {
      setResetting(false);
    }
  }

  return (
    <AppShell>
      <div className="transition-colors">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Preferences</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">Settings</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">Choose how MaatruCare appears in this browser. Backend access remains protected.</p>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
          <div className="space-y-6">
            <SettingsSection reducedMotion={reducedMotion} eyebrow="Authenticated account" title="Account information" iconTone="violet" icon={<UserRound size={17} />}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-[#E8D7E0] text-lg font-semibold text-[#6D3A5B]">{initials(account?.name ?? "")}</div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-[#211C1F]">{account?.name?.trim() || "Account name unavailable"}</h2>
                    <p className="mt-1 text-xs text-[#9A9196]">Name from your MaatruCare account</p>
                  </div>
                </div>
                <Link href="/profile" className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-[11px] border border-[#DCCBD5] bg-white px-3 text-xs font-semibold text-[#6D3A5B] transition hover:border-[#B86B87] hover:bg-[#FBF8F7]"><UserRoundPen size={15} />Edit profile</Link>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <InfoItem icon={<Mail size={15} />} label="Sign-in email" value={email || "Not available"} />
                <InfoItem icon={<Phone size={15} />} label="Phone" value={profile.phone.trim() && profile.phone !== "+91 90000 00001" ? profile.phone : "Not provided"} />
                <InfoItem icon={<Globe2 size={15} />} label="Preferred language" value={carePreferences.preferredLanguage} />
              </div>
              <p className="mt-4 rounded-[12px] bg-[#FBF8F7] p-3 text-[11px] leading-5 text-[#756D72]">Account name is persisted by MaatruCare; sign-in email comes from your authenticated session. Phone and display preferences stay in this browser for your account. Use fictional information for demonstrations.</p>
            </SettingsSection>

            <SettingsSection reducedMotion={reducedMotion} eyebrow="Care preferences" title="Future coordination preferences" iconTone="teal" icon={<SlidersHorizontal size={17} />}>
              <p className="mb-5 rounded-[12px] bg-[#FBF8F7] p-3 text-[11px] leading-5 text-[#756D72]">Selections are saved in this browser. These choices do not send messages, schedule reminders, or change sharing permissions.</p>
              <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                {carePreferenceItems.map((item) => (
                  <SelectField key={item.key} label={item.label} value={carePreferences[item.key]} onChange={(value) => setCarePreference(item.key, value)} options={item.options} />
                ))}
              </div>
            </SettingsSection>

            <SettingsSection reducedMotion={reducedMotion} eyebrow="Notifications" title="Local notification preferences" iconTone="sky" icon={<Bell size={17} />}>
              <p className="mb-5 rounded-[12px] bg-[#FBF8F7] p-3 text-[11px] leading-5 text-[#756D72]">These switches persist in this browser only. Email, SMS, push notifications, and reminders are not sent.</p>
              <div className="divide-y divide-[#EFE8EB]">
                {notificationItems.map((item) => (
                  <ToggleRow key={item.key} title={item.title} description={item.description} enabled={notifications[item.key]} onToggle={() => toggleNotification(item.key)} />
                ))}
              </div>
            </SettingsSection>
          </div>

          <div className="space-y-6">
            <SettingsSection reducedMotion={reducedMotion} eyebrow="Privacy & sharing" title="Access boundaries" iconTone="indigo" icon={<ShieldCheck size={17} />} tone="rose">
              <div className="flex gap-3 rounded-[14px] bg-[#FBF8F7] p-4">
                <LockKeyhole size={18} className="mt-0.5 shrink-0 text-[#6D3A5B]" />
                <p className="text-xs leading-5 text-[#756D72]">Your account is linked to its own care workspace. You choose what each caregiver can access. Use fictional information for demonstrations.</p>
              </div>
              <div className="mt-4 space-y-2">
                <LinkRow href="/consent" icon={<Eye size={16} />} title="Review sharing permissions" description="Change individual permission categories where the backend supports it." />
                <LinkRow href="/timeline" icon={<FileText size={16} />} title="View activity timeline" description="Review coordination events returned by the backend." />
              </div>
            </SettingsSection>

            <SettingsSection reducedMotion={reducedMotion} eyebrow="Accessibility" title="Display and motion" iconTone="violet" icon={<Accessibility size={17} />}>
              <div className="divide-y divide-[#EFE8EB]">
                <ToggleRow title="Dark mode" description="Use a darker appearance across the application." enabled={theme === "dark"} onToggle={toggleTheme} />
                <ToggleRow title="Larger text" description="Increase text size across application content." enabled={largerText} onToggle={() => setLargerText(!largerText)} />
                <ToggleRow title="High contrast" description="Strengthen text, border, and focus contrast." enabled={highContrast} onToggle={() => setHighContrast(!highContrast)} />
                <ToggleRow title="Reduced motion" description="Reduce movement effects throughout the application." enabled={reducedMotion} onToggle={() => setReducedMotion(!reducedMotion)} />
              </div>
            </SettingsSection>

            <SettingsSection reducedMotion={reducedMotion} eyebrow="Account" title="Account actions" iconTone="slate" icon={<MessageCircle size={17} />}>
              <div className="flex items-start gap-3 rounded-[14px] bg-[#FBF8F7] p-4">
                <LockKeyhole size={17} className="mt-0.5 shrink-0 text-[#6D3A5B]" />
                <p className="text-xs leading-5 text-[#756D72]">Manage your session and password here. For account deletion and retention questions, contact the application administrator.</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={accountBusy} onClick={() => { setAccountBusy(true); void signOut().catch((error) => setAccountMessage(error instanceof Error ? error.message : "Sign out failed")).finally(() => setAccountBusy(false)); }} className="mc-button mc-button--secondary">Sign out</button>{email && <button type="button" disabled={accountBusy} onClick={() => { setAccountBusy(true); void sendPasswordReset(email).then(() => setAccountMessage("Password reset email requested. Check your inbox.")).catch((error) => setAccountMessage(error instanceof Error ? error.message : "Unable to request password reset")).finally(() => setAccountBusy(false)); }} className="mc-button mc-button--secondary">Request password reset email</button>}</div>{accountMessage && <p role="status" className="mc-caption mt-3">{accountMessage}</p>}
            </SettingsSection>

            <SettingsSection reducedMotion={reducedMotion} eyebrow="Data management" title="Lifestyle data reset" iconTone="amber" icon={<RotateCcw size={17} />}>
              <p className="text-xs leading-5 text-[#756D72]">{resetPreview?.explanation ?? "Checking whether this workspace supports a demo reset..."}</p>
              {resetPreview?.enabled && <>
                <label className="mt-4 flex items-start gap-3 rounded-[11px] bg-[#FBF8F7] p-3 text-xs leading-5 text-[#756D72]"><input type="checkbox" checked={resetPreferences} onChange={(event) => { setResetPreview(null); setResetPreferences(event.target.checked); }} className="mt-1 h-4 w-4 accent-[#6D3A5B]" />Also reset personal Lifestyle goals and preferences.</label>
                <ul className="mt-3 space-y-1 text-xs text-[#756D72]">{Object.entries(resetPreview.counts).map(([label, count]) => <li key={label}>{label.replaceAll("_", " ")}: {count} record(s) to delete</li>)}</ul>
                <button type="button" onClick={() => void resetLifestyle()} disabled={resetting} className="mt-4 flex min-h-11 items-center gap-2 rounded-[11px] border border-[#D8B7AD] px-4 py-3 text-xs font-semibold text-[#9A5145] disabled:opacity-60"><RotateCcw size={15} />{resetting ? "Resetting..." : "Confirm demo lifestyle reset"}</button>
              </>}
              {resetMessage && <div role={resetSucceeded ? "status" : "alert"} className="mt-3 rounded-[11px] bg-[#FBF8F7] p-3 text-[11px] leading-5 text-[#756D72]"><p>{resetMessage}</p>{resetSucceeded && <Link href="/lifestyle" className="mt-2 inline-flex min-h-9 items-center font-semibold text-[#6D3A5B] underline underline-offset-2">Review refreshed Lifestyle records</Link>}</div>}
            </SettingsSection>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2 border-t border-[#E9E1E4] pt-5 text-[11px] text-[#9A9196]">
          <MessageCircle size={14} />
          Local preferences are saved in this browser and are not sent to the backend.
        </div>
      </div>
    </AppShell>
  );
}

function SettingsSection({ reducedMotion, eyebrow, title, icon, iconTone = "violet", children, tone = "white" }: { reducedMotion: boolean; eyebrow: string; title: string; icon: React.ReactNode; iconTone?: "violet" | "teal" | "sky" | "indigo" | "slate" | "amber"; children: React.ReactNode; tone?: "white" | "rose" }) {
  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.28 }}
      className={`rounded-[20px] border p-5 sm:p-6 ${tone === "rose" ? "border-[#E4D7DF] bg-[#F8F2F6]" : "border-[#E9E1E4] bg-white"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mc-feature-icon mc-feature-icon--${iconTone} flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]`}>{icon}</div>
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">{eyebrow}</p><h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">{title}</h2></div>
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="min-w-0 rounded-[14px] border border-[#EFE8EB] bg-[#FBF8F7] p-3"><div className="flex items-center gap-2 text-[#9A9196]">{icon}<span className="text-[10px] font-semibold uppercase tracking-[0.1em]">{label}</span></div><p className="mt-2 truncate text-xs font-medium text-[#211C1F]">{value}</p></div>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  const id = `preference-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <label htmlFor={id} className="block"><span className="mb-2 block text-xs font-semibold text-[#756D72]">{label}</span><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[11px] border border-[#E9E1E4] bg-[#FBF8F7] px-3 text-xs font-medium text-[#211C1F] outline-none transition focus:border-[#B86B87] focus:ring-2 focus:ring-[#EBDCE5]">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function ToggleRow({ title, description, enabled, onToggle }: { title: string; description: string; enabled: boolean; onToggle: () => void }) {
  const id = `setting-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"><div className="min-w-0"><p id={`${id}-label`} className="text-sm font-semibold text-[#211C1F]">{title}</p><p id={`${id}-description`} className="mt-1 text-xs leading-5 text-[#9A9196]">{description}</p></div><button type="button" role="switch" aria-checked={enabled} aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} onClick={onToggle} className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${enabled ? "bg-[#6D3A5B]" : "bg-[#D9D1D5]"}`}><span aria-hidden="true" className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} /></button></div>;
}

function LinkRow({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-[13px] p-3 transition hover:bg-white"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#6D3A5B]">{icon}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#211C1F]">{title}</span><span className="mt-1 block text-[11px] leading-4 text-[#9A9196]">{description}</span></span><ChevronRight size={15} className="shrink-0 text-[#9A9196]" /></Link>;
}
