"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Accessibility,
  Bell,
  Check,
  ChevronRight,
  Eye,
  FileText,
  Globe2,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UserRoundPen,
  Volume2,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";

const initialNotifications = {
  appointmentReminders: true,
  taskReminders: true,
  handoffNotifications: true,
  careCircleActivity: false,
};

type NotificationKey = keyof typeof initialNotifications;

const notificationItems: Array<{
  key: NotificationKey;
  title: string;
  description: string;
}> = [
  {
    key: "appointmentReminders",
    title: "Appointment reminders",
    description: "A gentle reminder before an upcoming visit.",
  },
  {
    key: "taskReminders",
    title: "Task reminders",
    description: "Stay on top of shared coordination responsibilities.",
  },
  {
    key: "handoffNotifications",
    title: "Care handoff notifications",
    description: "Know when a caregiver sends or acknowledges a handoff.",
  },
  {
    key: "careCircleActivity",
    title: "Care Circle activity",
    description: "See updates from the people you have approved.",
  },
];

const preferenceOptions = ["Email", "Text message", "Email and text message"];

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [communicationPreference, setCommunicationPreference] = useState("Email and text message");
  const [caregiverUpdates, setCaregiverUpdates] = useState("Only approved updates");
  const [appointmentReminders, setAppointmentReminders] = useState("One day before");
  const [largerText, setLargerText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [feedback, setFeedback] = useState("");

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2600);
  }

  function toggleNotification(key: NotificationKey) {
    setNotifications((current) => ({ ...current, [key]: !current[key] }));
  }

  const pageClassName = [
    "transition-colors",
    largerText ? "text-[15px]" : "",
    highContrast ? "[&_p]:text-[#4E454A] [&_label]:text-[#4E454A]" : "",
  ].join(" ");

  return (
    <AppShell>
      <div className={pageClassName}>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
              Patient control
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">
              Settings
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">
              Shape how MaatruCare supports your coordination space.
            </p>
          </div>

          {feedback && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 self-start rounded-[12px] border border-[#CFE0D5] bg-[#F1F8F3] px-3 py-2 text-xs font-medium text-[#3F6D56] sm:self-auto"
              role="status"
            >
              <Check size={15} />
              {feedback}
            </motion.div>
          )}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
          <div className="space-y-6">
            <SettingsSection reducedMotion={reducedMotion} eyebrow="Profile" title="Your profile" icon={<UserRound size={17} />}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#E8D7E0] text-lg font-semibold text-[#6D3A5B]">
                    AR
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#211C1F]">Ananya Rao</h2>
                    <p className="mt-1 text-xs text-[#9A9196]">Patient</p>
                  </div>
                </div>
                <ActionButton icon={<UserRoundPen size={15} />} onClick={() => showFeedback("Profile editing is ready for your updates.")}>
                  Edit profile
                </ActionButton>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <InfoItem icon={<Phone size={15} />} label="Phone" value="+91 90000 00001" />
                <InfoItem icon={<Mail size={15} />} label="Email" value="ananya.rao@example.test" />
                <InfoItem icon={<Globe2 size={15} />} label="Preferred language" value={preferredLanguage} />
              </div>
            </SettingsSection>

            <SettingsSection reducedMotion={reducedMotion} eyebrow="Care preferences" title="How care coordination reaches you" icon={<SlidersHorizontal size={17} />}>
              <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                <SelectField label="Preferred language" value={preferredLanguage} onChange={setPreferredLanguage} options={["English", "Hindi", "Tamil"]} />
                <SelectField label="Communication preference" value={communicationPreference} onChange={setCommunicationPreference} options={preferenceOptions} />
                <SelectField label="Caregiver update preference" value={caregiverUpdates} onChange={setCaregiverUpdates} options={["Only approved updates", "All coordination updates", "No caregiver updates"]} />
                <SelectField label="Appointment reminder preference" value={appointmentReminders} onChange={setAppointmentReminders} options={["One day before", "Two days before", "One week before"]} />
              </div>
            </SettingsSection>

            <SettingsSection reducedMotion={reducedMotion} eyebrow="Notifications" title="Choose what you hear about" icon={<Bell size={17} />}>
              <div className="divide-y divide-[#EFE8EB]">
                {notificationItems.map((item) => (
                  <ToggleRow
                    key={item.key}
                    title={item.title}
                    description={item.description}
                    enabled={notifications[item.key]}
                    onToggle={() => toggleNotification(item.key)}
                  />
                ))}
              </div>
            </SettingsSection>
          </div>

          <div className="space-y-6">
            <SettingsSection reducedMotion={reducedMotion} eyebrow="Privacy & patient control" title="Your information stays yours" icon={<ShieldCheck size={17} />} tone="rose">
              <div className="flex gap-3 rounded-[14px] bg-[#FBF8F7] p-4">
                <LockKeyhole size={18} className="mt-0.5 shrink-0 text-[#6D3A5B]" />
                <p className="text-xs leading-5 text-[#756D72]">
                  Approved information is shared only with authorized Care Circle members. MaatruCare supports coordination and does not make medical decisions.
                </p>
              </div>
              <div className="mt-4 space-y-2">
                <LinkRow href="/consent" icon={<Eye size={16} />} title="Manage consent and sharing" description="Review who can see approved care information." />
                <LinkRow href="/timeline" icon={<FileText size={16} />} title="View activity history" description="See the coordination timeline and recorded updates." />
              </div>
            </SettingsSection>

            <SettingsSection reducedMotion={reducedMotion} eyebrow="Accessibility" title="Make your space easier to use" icon={<Accessibility size={17} />}>
              <div className="divide-y divide-[#EFE8EB]">
                <ToggleRow title="Larger text" description="Increase the reading size across this page." enabled={largerText} onToggle={() => setLargerText((value) => !value)} />
                <ToggleRow title="High contrast" description="Use stronger text contrast for easier scanning." enabled={highContrast} onToggle={() => setHighContrast((value) => !value)} />
                <ToggleRow title="Reduced motion" description="Use fewer movement effects while navigating." enabled={reducedMotion} onToggle={() => setReducedMotion((value) => !value)} />
              </div>
            </SettingsSection>

            <SettingsSection reducedMotion={reducedMotion} eyebrow="Account" title="Account controls" icon={<KeyRound size={17} />}>
              <div className="space-y-2">
                <AccountAction icon={<KeyRound size={16} />} label="Change password" onClick={() => showFeedback("Password change flow opened.")} />
                <AccountAction icon={<UserRound size={16} />} label="Sign out" onClick={() => showFeedback("You are still signed in to this demo space.")} />
                <AccountAction icon={<MessageCircle size={16} />} label="Delete account" danger onClick={() => showFeedback("Account deletion requires confirmation.")} />
              </div>
            </SettingsSection>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2 border-t border-[#E9E1E4] pt-5 text-[11px] text-[#9A9196]">
          <Volume2 size={14} />
          Your settings apply to this private coordination space.
        </div>
      </div>
    </AppShell>
  );
}

function SettingsSection({
  reducedMotion,
  eyebrow,
  title,
  icon,
  children,
  tone = "white",
}: {
  reducedMotion: boolean;
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "white" | "rose";
}) {
  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.28 }}
      className={`rounded-[20px] border p-5 sm:p-6 ${tone === "rose" ? "border-[#E4D7DF] bg-[#F8F2F6]" : "border-[#E9E1E4] bg-white"}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F3EAF0] text-[#6D3A5B]">{icon}</div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">{eyebrow}</p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">{title}</h2>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#EFE8EB] bg-[#FBF8F7] p-3">
      <div className="flex items-center gap-2 text-[#9A9196]">{icon}<span className="text-[10px] font-semibold uppercase tracking-[0.1em]">{label}</span></div>
      <p className="mt-2 truncate text-xs font-medium text-[#211C1F]">{value}</p>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-[#756D72]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[11px] border border-[#E9E1E4] bg-[#FBF8F7] px-3 text-xs font-medium text-[#211C1F] outline-none transition focus:border-[#B86B87] focus:ring-2 focus:ring-[#EBDCE5]">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ToggleRow({ title, description, enabled, onToggle }: { title: string; description: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-semibold text-[#211C1F]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#9A9196]">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={enabled} aria-label={`${title}: ${enabled ? "on" : "off"}`} onClick={onToggle} className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${enabled ? "bg-[#6D3A5B]" : "bg-[#D9D1D5]"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function ActionButton({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex h-10 items-center justify-center gap-2 rounded-[11px] border border-[#DCCBD5] bg-white px-3 text-xs font-semibold text-[#6D3A5B] transition hover:border-[#B86B87] hover:bg-[#FBF8F7] active:scale-[0.98]">{icon}{children}</button>;
}

function LinkRow({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-[13px] p-3 transition hover:bg-white"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#6D3A5B]">{icon}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#211C1F]">{title}</span><span className="mt-1 block text-[11px] leading-4 text-[#9A9196]">{description}</span></span><ChevronRight size={15} className="shrink-0 text-[#9A9196]" /></Link>;
}

function AccountAction({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-xs font-semibold transition hover:bg-[#FBF8F7] active:scale-[0.99] ${danger ? "text-[#B85C62]" : "text-[#6D3A5B]"}`}><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#FBF8F7]">{icon}</span>{label}<ChevronRight size={15} className="ml-auto text-[#9A9196]" /></button>;
}
