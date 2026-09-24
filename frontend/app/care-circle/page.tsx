"use client";

import AppShell from "@/components/layout/AppShell";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useMaatruCareDemo } from "@/context/MaatruCareDemoContext";

const caregivers = [
  {
    name: "Rahul Rao",
    relation: "Partner",
    role: "Primary caregiver",
    access: "Care coordination",
    initials: "RR",
    status: "Active",
  },
  {
    name: "Lakshmi Rao",
    relation: "Mother",
    role: "Family caregiver",
    access: "Appointments & tasks",
    initials: "LR",
    status: "Active",
  },
  {
    name: "Priya Rao",
    relation: "Sister",
    role: "Support caregiver",
    access: "Selected updates",
    initials: "PR",
    status: "Active",
  },
] as const;

const permissionKeys = [
  "Appointments",
  "Coordination tasks",
  "Care handoffs",
  "Approved care updates",
] as const;

type Caregiver = (typeof caregivers)[number];
type CaregiverName = Caregiver["name"];
type PermissionKey = (typeof permissionKeys)[number];
type CaregiverPermissions = Record<PermissionKey, boolean>;

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

export default function CareCirclePage() {
  const { permissions, updateConsentPermission } = useMaatruCareDemo();
  const [selectedCaregiver, setSelectedCaregiver] =
    useState<Caregiver | null>(null);
  const [feedback, setFeedback] = useState("");
  return (
    <AppShell>
      <div>
        {/* Header */}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
              Care Circle
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">
              People you trust
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">
              Choose who can help coordinate your care and control what each
              person can access.
            </p>
          </div>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setFeedback("Caregiver invitations are demo-only in this session.");
              window.setTimeout(() => setFeedback(""), 2600);
            }}
            className="flex items-center justify-center gap-2 rounded-[13px] bg-[#6D3A5B] px-4 py-2.5 text-xs font-semibold text-white shadow-sm"
          >
            <UserPlus size={15} />
            Add caregiver
          </motion.button>
        </div>

        {feedback && (
          <div className="mt-5 rounded-[12px] border border-[#CFE0D5] bg-[#F1F8F3] px-3 py-2 text-xs font-medium text-[#3F6D56]" role="status">
            {feedback}
          </div>
        )}

        {/* Patient control banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 rounded-[20px] border border-[#E4D7DF] bg-[#F8F2F6] p-5"
        >
          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#EBDCE5] text-[#6D3A5B]">
              <ShieldCheck size={19} />
            </div>

            <div>
              <p className="text-sm font-semibold text-[#211C1F]">
                You are in control
              </p>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#756D72]">
                Caregivers only receive the information and coordination access
                you approve. You can change or revoke access at any time.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Caregiver list */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#211C1F]">
                Your caregivers
              </h2>

              <p className="mt-1 text-[11px] text-[#9A9196]">
                3 people currently connected
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#4F8068]">
              <CheckCircle2 size={13} />
              All connections active
            </div>
          </div>

          <div className="space-y-3">
            {caregivers.map((caregiver, index) => (
              <motion.div
                key={caregiver.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
                className="group rounded-[18px] border border-[#E9E1E4] bg-white p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {/* Avatar */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F0E5EB] text-xs font-semibold text-[#6D3A5B]">
                    {caregiver.initials}
                  </div>

                  {/* Person */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#211C1F]">
                        {caregiver.name}
                      </h3>

                      <span className="rounded-full bg-[#F5F1F3] px-2 py-1 text-[9px] font-medium text-[#756D72]">
                        {caregiver.relation}
                      </span>
                    </div>

                    <p className="mt-1 text-[10px] text-[#9A9196]">
                      {caregiver.role}
                    </p>
                  </div>

                  {/* Access */}
                  <div className="sm:w-44">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9A9196]">
                      Access
                    </p>

                    <p className="mt-1 text-[11px] font-medium text-[#211C1F]">
                      {caregiver.access}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-[#EEF5F0] px-2.5 py-1.5 text-[9px] font-semibold text-[#4F8068]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4F8068]" />
                      {caregiver.status}
                    </span>

                    <button
                    onClick={() => setSelectedCaregiver(caregiver)}
                      aria-label={`Manage ${caregiver.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9A9196] transition hover:bg-[#F7F3F5] hover:text-[#6D3A5B]"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Information cards */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Users size={17} />}
            title="Care coordination"
            text="Help with appointments, tasks and handoffs."
          />

          <InfoCard
            icon={<Mail size={17} />}
            title="Approved updates"
            text="Share selected information with trusted people."
          />

          <InfoCard
            icon={<ShieldCheck size={17} />}
            title="Patient controlled"
            text="Access can be reviewed or revoked by you."
          />
        </div>

        <AnimatePresence>
          {selectedCaregiver && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedCaregiver(null)}
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
              />

              {/* Drawer */}
              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{
                  type: "spring",
                  damping: 28,
                  stiffness: 280,
                }}
                className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[#E9E1E4] bg-white shadow-2xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#E9E1E4] px-6 py-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
                      Caregiver access
                    </p>

                    <h2 className="mt-1 text-lg font-semibold text-[#211C1F]">
                      {selectedCaregiver.name}
                    </h2>
                  </div>

                  <button
                    onClick={() => setSelectedCaregiver(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F3F5] text-[#756D72] hover:text-[#6D3A5B]"
                  >
                    <X size={17} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  {/* Caregiver identity */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F0E5EB] text-sm font-semibold text-[#6D3A5B]">
                      {selectedCaregiver.initials}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-[#211C1F]">
                        {selectedCaregiver.name}
                      </p>

                      <p className="mt-1 text-[10px] text-[#9A9196]">
                        {selectedCaregiver.relation} ·{" "}
                        {selectedCaregiver.role}
                      </p>
                    </div>
                  </div>

                 {/* Permissions */}
                    <div className="mt-8">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9A9196]">
                        Approved access
                    </p>

                    <div className="mt-3 space-y-2">
                        {permissionKeys.map((permission) => {
                        const caregiverName = selectedCaregiver.name;
                        const enabled =
                            permissions[caregiverName][permission];

                        return (
                            <button
                            key={permission}
                            onClick={() => updateConsentPermission(caregiverName, permission, !enabled)}
                            className="flex w-full items-center justify-between rounded-[14px] border border-[#E9E1E4] px-4 py-3 text-left transition hover:bg-[#FBF8F7]"
                            >
                            <span className="text-xs font-medium text-[#211C1F]">
                                {permission}
                            </span>

                            <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                                enabled
                                    ? "bg-[#E7EEE9] text-[#4F8068]"
                                    : "bg-[#F3EFF1] text-[#A59CA1]"
                                }`}
                            >
                                {enabled ? <Check size={13} /> : <X size={13} />}
                            </span>
                            </button>
                        );
                        })}
                    </div>
                    </div>

                  {/* Privacy */}
                  <div className="mt-6 rounded-[16px] bg-[#F8F2F6] p-4">
                    <div className="flex gap-3">
                      <ShieldCheck
                        size={17}
                        className="mt-0.5 shrink-0 text-[#6D3A5B]"
                      />

                      <div>
                        <p className="text-xs font-semibold text-[#211C1F]">
                          Patient-controlled access
                        </p>

                        <p className="mt-1 text-[10px] leading-4 text-[#756D72]">
                          This caregiver can only access information you have
                          approved. Clinical information is not shared
                          automatically.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Access history */}
                  <div className="mt-8">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9A9196]">
                      Access history
                    </p>

                    <div className="mt-3 rounded-[14px] border border-[#E9E1E4] p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2
                          size={16}
                          className="mt-0.5 text-[#4F8068]"
                        />

                        <div>
                          <p className="text-[11px] font-semibold text-[#211C1F]">
                            Access currently active
                          </p>

                          <p className="mt-1 text-[10px] leading-4 text-[#9A9196]">
                            Permissions were last reviewed by Ananya.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-[#E9E1E4] p-6">
                  <button
                    onClick={() => setSelectedCaregiver(null)}
                    className="w-full rounded-[13px] border border-[#E9E1E4] bg-white py-3 text-xs font-semibold text-[#6D3A5B] transition hover:bg-[#F8F2F6]"
                  >
                    Close
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
    </div>
    </AppShell>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[17px] border border-[#E9E1E4] bg-white p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F4EDF1] text-[#6D3A5B]">
        {icon}
      </div>

      <h3 className="mt-4 text-xs font-semibold text-[#211C1F]">
        {title}
      </h3>

      <p className="mt-1.5 text-[10px] leading-4 text-[#756D72]">
        {text}
      </p>
    </div>
  );
}