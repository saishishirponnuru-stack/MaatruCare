"use client";

import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  History,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useMaatruCareDemo } from "@/context/MaatruCareDemoContext";

const permissionKeys = [
  "Appointments",
  "Coordination tasks",
  "Care handoffs",
  "Approved care updates",
] as const;

type PermissionKey = (typeof permissionKeys)[number];
type CaregiverName = "Rahul Rao" | "Lakshmi Rao" | "Priya Rao";
type AccessStatus = "Active" | "Revoked";

type Caregiver = {
  name: CaregiverName;
  relation: string;
  role: string;
  initials: string;
  lastUpdate: string;
};

type CaregiverPermissions = Record<PermissionKey, boolean>;

const caregivers: Caregiver[] = [
  {
    name: "Rahul Rao",
    relation: "Partner",
    role: "Primary caregiver",
    initials: "RR",
    lastUpdate: "Updated 24 Sep",
  },
  {
    name: "Lakshmi Rao",
    relation: "Mother",
    role: "Family caregiver",
    initials: "LR",
    lastUpdate: "Updated 26 Sep",
  },
  {
    name: "Priya Rao",
    relation: "Sister",
    role: "Support caregiver",
    initials: "PR",
    lastUpdate: "Updated 22 Sep",
  },
];

const initialPermissions: Record<CaregiverName, CaregiverPermissions> = {
  "Rahul Rao": {
    Appointments: true,
    "Coordination tasks": true,
    "Care handoffs": true,
    "Approved care updates": true,
  },
  "Lakshmi Rao": {
    Appointments: true,
    "Coordination tasks": true,
    "Care handoffs": false,
    "Approved care updates": true,
  },
  "Priya Rao": {
    Appointments: false,
    "Coordination tasks": true,
    "Care handoffs": false,
    "Approved care updates": true,
  },
};

const permissionDescriptions: Record<PermissionKey, string> = {
  Appointments: "Upcoming appointment details and scheduling information.",
  "Coordination tasks":
    "Shared responsibilities such as transport and preparation.",
  "Care handoffs":
    "Approved coordination context transferred between caregivers.",
  "Approved care updates":
    "Information explicitly reviewed and approved for Care Circle sharing.",
};

const initialStatuses: Record<CaregiverName, AccessStatus> = {
  "Rahul Rao": "Active",
  "Lakshmi Rao": "Active",
  "Priya Rao": "Active",
};

const accessHistory = [
  {
    date: "26 Sep",
    name: "Lakshmi Rao",
    detail: "Reviewed appointment coordination information",
  },
  {
    date: "24 Sep",
    name: "Rahul Rao",
    detail: "Viewed upcoming appointment details",
  },
  {
    date: "22 Sep",
    name: "Priya Rao",
    detail: "Access permission updated",
  },
] as const;

export default function ConsentPage() {
  const { permissions, updateConsentPermission } = useMaatruCareDemo();
  const [selectedCaregiver, setSelectedCaregiver] =
    useState<CaregiverName>("Rahul Rao");
  const [statuses, setStatuses] =
    useState<Record<CaregiverName, AccessStatus>>(initialStatuses);

  const summary = useMemo(() => {
    const activeCaregivers = caregivers.filter(
      (caregiver) => statuses[caregiver.name] === "Active",
    );

    return {
      members: caregivers.length,
      approved: activeCaregivers.reduce(
        (total, caregiver) =>
          total +
          permissionKeys.filter(
            (permission) => permissions[caregiver.name][permission],
          ).length,
        0,
      ),
      limited: activeCaregivers.filter(
        (caregiver) =>
          permissionKeys.some(
            (permission) => !permissions[caregiver.name][permission],
          ),
      ).length,
      revoked: caregivers.filter(
        (caregiver) => statuses[caregiver.name] === "Revoked",
      ).length,
    };
  }, [permissions, statuses]);

  const selectedIsRevoked = statuses[selectedCaregiver] === "Revoked";
  const selectedPermissionCount = permissionKeys.filter(
    (permission) => permissions[selectedCaregiver][permission],
  ).length;

  function togglePermission(permission: PermissionKey) {
    if (selectedIsRevoked) return;

    updateConsentPermission(selectedCaregiver, permission, !permissions[selectedCaregiver][permission]);
  }

  function revokeSelectedAccess() {
    setStatuses((current) => ({
      ...current,
      [selectedCaregiver]: "Revoked",
    }));
  }

  return (
    <AppShell>
      <div>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
              Patient control
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">
              Consent &amp; sharing
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">
              You control what your Care Circle can see.
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex gap-4 rounded-[20px] border border-[#E4D7DF] bg-[#F8F2F6] p-5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#EBDCE5] text-[#6D3A5B]">
            <ShieldCheck size={19} />
          </div>

          <p className="self-center max-w-3xl text-xs leading-5 text-[#756D72]">
            Your information stays under your control. You can review, change
            or revoke sharing permissions at any time.
          </p>
        </motion.div>

        <section className="mt-8">
          <SectionHeading eyebrow="Sharing overview" title="Your sharing at a glance" />

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={<Users size={17} />} label="Care Circle members" value={summary.members} />
            <SummaryCard icon={<CheckCircle2 size={17} />} label="Approved access" value={summary.approved} />
            <SummaryCard icon={<EyeOff size={17} />} label="Limited access" value={summary.limited} />
            <SummaryCard icon={<X size={17} />} label="Revoked access" value={summary.revoked} />
          </div>
        </section>

        <section className="mt-8">
          <SectionHeading eyebrow="Care Circle access" title="People you have chosen to share with" />

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {caregivers.map((caregiver, index) => {
              const isSelected = caregiver.name === selectedCaregiver;
              const isRevoked = statuses[caregiver.name] === "Revoked";
              const permissionCount = permissionKeys.filter(
                (permission) => permissions[caregiver.name][permission],
              ).length;

              return (
                <motion.button
                  key={caregiver.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07 }}
                  onClick={() => setSelectedCaregiver(caregiver.name)}
                  className={`text-left rounded-[18px] border bg-white p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)] transition ${
                    isSelected
                      ? "border-[#B98FA5] ring-2 ring-[#F3EAF0]"
                      : "border-[#E9E1E4] hover:border-[#D7C2CD]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0E5EB] text-xs font-semibold text-[#6D3A5B]">
                        {caregiver.initials}
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-[#211C1F]">{caregiver.name}</h3>
                        <p className="mt-1 text-[10px] text-[#9A9196]">{caregiver.relation} · {caregiver.role}</p>
                      </div>
                    </div>

                    <ChevronRight size={16} className="mt-1 shrink-0 text-[#9A9196]" />
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-[#F0E9EC] pt-4">
                    <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-semibold ${isRevoked ? "bg-[#FBEDEE] text-[#B85C62]" : "bg-[#EEF5F0] text-[#4F8068]"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isRevoked ? "bg-[#B85C62]" : "bg-[#4F8068]"}`} />
                      {isRevoked ? "Revoked" : "Active"}
                    </span>
                    <span className="text-[10px] font-medium text-[#756D72]">{permissionCount}/4 approved</span>
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[#9A9196]">
                    <Clock3 size={12} /> {caregiver.lastUpdate}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-[22px] border border-[#E9E1E4] bg-white shadow-[0_8px_30px_rgba(33,28,31,0.035)]">
          <div className="border-b border-[#F0E9EC] px-6 py-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <SectionHeading eyebrow="Sharing categories" title="Approved sharing permissions" />
                <p className="mt-2 text-[11px] text-[#756D72]">
                  Choose what {selectedCaregiver} can access. These settings only control sharing.
                </p>
              </div>

              <span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-semibold ${selectedIsRevoked ? "bg-[#FBEDEE] text-[#B85C62]" : "bg-[#F3EAF0] text-[#6D3A5B]"}`}>
                {selectedIsRevoked ? "Access revoked" : `${selectedPermissionCount} of 4 approved`}
              </span>
            </div>
          </div>

          <div className="divide-y divide-[#F0E9EC]">
            {permissionKeys.map((permission) => {
              const enabled = permissions[selectedCaregiver][permission];

              return (
                <div key={permission} className="flex items-center gap-4 px-6 py-4">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${enabled && !selectedIsRevoked ? "bg-[#EEF5F0] text-[#4F8068]" : "bg-[#F7F3F5] text-[#9A9196]"}`}>
                    {enabled && !selectedIsRevoked ? <Eye size={16} /> : <EyeOff size={16} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#211C1F]">{permission}</p>
                    <p className="mt-1 max-w-2xl text-[10px] leading-4 text-[#756D72]">{permissionDescriptions[permission]}</p>
                  </div>

                  <button
                    role="switch"
                    aria-checked={enabled && !selectedIsRevoked}
                    aria-label={`${permission} for ${selectedCaregiver}`}
                    disabled={selectedIsRevoked}
                    onClick={() => togglePermission(permission)}
                    className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition ${enabled && !selectedIsRevoked ? "bg-[#6D3A5B]" : "bg-[#DCD3D7]"} ${selectedIsRevoked ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled && !selectedIsRevoked ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <SectionHeading eyebrow="Access history" title="Recent sharing activity" />

            <div className="mt-4 divide-y divide-[#F0E9EC] rounded-[18px] border border-[#E9E1E4] bg-white px-5">
              {accessHistory.map((item) => (
                <div key={`${item.date}-${item.name}`} className="flex items-start gap-4 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F3EAF0] text-[#6D3A5B]"><History size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-xs font-semibold text-[#211C1F]">{item.name}</p>
                      <span className="text-[10px] text-[#9A9196]">{item.date}</span>
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-[#756D72]">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-[#9A9196]">Synthetic demo activity for this prototype.</p>
          </div>

          <div className="rounded-[18px] border border-[#E9E1E4] bg-white p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)]">
            <div className="flex items-center gap-3">
              <UserRound size={18} className="text-[#6D3A5B]" />
              <h2 className="text-sm font-semibold text-[#211C1F]">Need to change access?</h2>
            </div>

            <p className="mt-3 text-[11px] leading-5 text-[#756D72]">You can update or revoke a caregiver&apos;s access at any time.</p>

            <div className="mt-5 space-y-2">
              <Link href="/care-circle" className="flex items-center justify-center gap-2 rounded-[13px] bg-[#6D3A5B] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#4D2941]">
                Review Care Circle
                <ChevronRight size={15} />
              </Link>

              <button
                onClick={revokeSelectedAccess}
                disabled={selectedIsRevoked}
                className="flex w-full items-center justify-center gap-2 rounded-[13px] border border-[#E9E1E4] bg-white px-4 py-3 text-xs font-semibold text-[#B85C62] transition hover:bg-[#FBEDEE] disabled:cursor-default disabled:border-[#E9E1E4] disabled:text-[#9A9196]"
              >
                <X size={15} />
                {selectedIsRevoked ? `${selectedCaregiver} access revoked` : `Revoke ${selectedCaregiver} access`}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[18px] border border-[#E4D7DF] bg-[#F8F2F6] p-5">
          <div className="flex gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#6D3A5B]" />
            <div>
              <h2 className="text-sm font-semibold text-[#211C1F]">Patient-controlled sharing</h2>
              <p className="mt-2 max-w-3xl text-[11px] leading-5 text-[#756D72]">
                MaatruCare only shares information that you approve. Caregivers cannot change your permissions. Clinical decisions remain with qualified healthcare professionals.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">{eyebrow}</p>
      <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">{title}</h2>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[18px] border border-[#E9E1E4] bg-white p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F4EDF1] text-[#6D3A5B]">{icon}</div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#211C1F]">{value}</p>
    </div>
  );
}