"use client";

import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  HeartHandshake,
  ListChecks,
  ShieldCheck,
  Sprout,
  Users,
} from "lucide-react";

const phases = [
  "Preconception",
  "Pregnancy",
  "Postnatal",
  "Early motherhood",
] as const;

type Phase = (typeof phases)[number];

type PhaseDetails = {
  focus: string;
  examples: string[];
};

const phaseDetails: Record<Phase, PhaseDetails> = {
  Preconception: {
    focus: "Planning and preparation",
    examples: [
      "Care Circle setup",
      "Appointment planning",
      "Shared responsibilities",
    ],
  },
  Pregnancy: {
    focus: "Coordinating ongoing care",
    examples: [
      "Upcoming appointments",
      "Care Circle tasks",
      "Care handoffs",
      "Approved care updates",
    ],
  },
  Postnatal: {
    focus: "Coordinating the transition home",
    examples: [
      "Follow-up appointments",
      "Shared responsibilities",
      "Caregiver coordination",
    ],
  },
  "Early motherhood": {
    focus: "Keeping support coordinated",
    examples: [
      "Shared routines",
      "Appointments",
      "Caregiver responsibilities",
    ],
  },
};

const phaseIcons = {
  Preconception: Sprout,
  Pregnancy: CalendarDays,
  Postnatal: HeartHandshake,
  "Early motherhood": Users,
} satisfies Record<Phase, typeof Sprout>;

export default function JourneyPage() {
  const [selectedPhase, setSelectedPhase] = useState<Phase>("Pregnancy");

  return (
    <AppShell>
      <div>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
              Your orientation
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">
              Your motherhood journey
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">
              Stay oriented from preconception through early motherhood.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-[#E9E1E4] bg-white px-3.5 py-2">
            <ShieldCheck size={14} className="text-[#6D3A5B]" />
            <span className="text-[10px] font-semibold text-[#756D72]">
              Patient-controlled journey
            </span>
          </div>
        </div>

        <section className="mt-8 overflow-hidden rounded-[22px] border border-[#E9E1E4] bg-white shadow-[0_8px_30px_rgba(33,28,31,0.035)]">
          <div className="flex flex-col gap-3 border-b border-[#F0E9EC] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
                Journey overview
              </p>

              <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">
                Complete motherhood support
              </h2>
            </div>

            <span className="flex items-center gap-2 rounded-full bg-[#FBF8F7] px-3 py-1.5 text-[10px] font-medium text-[#756D72]">
              <Sprout size={14} className="text-[#6D3A5B]" />
              Select a phase to explore
            </span>
          </div>

          <div className="px-6 pb-7 pt-8">
            <div className="relative">
              <div className="absolute left-[8%] right-[8%] top-[18px] hidden h-px bg-[#E9E1E4] sm:block" />
              <div className="absolute left-[8%] top-[18px] hidden h-px bg-[#6D3A5B] sm:block sm:w-[28%]" />

              <div className="grid gap-4 sm:grid-cols-4 sm:gap-3">
                {phases.map((phase, index) => {
                  const isCompleted = index === 0;
                  const isCurrent = phase === "Pregnancy";
                  const isSelected = phase === selectedPhase;

                  return (
                    <motion.button
                      key={phase}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      onClick={() => setSelectedPhase(phase)}
                      className={`relative z-10 flex items-center gap-3 rounded-[14px] p-2 text-left transition sm:flex-col sm:gap-0 sm:text-center ${
                        isSelected ? "bg-[#FBF8F7]" : "hover:bg-[#FBF8F7]"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] bg-white ${
                          isCurrent
                            ? "border-[#6D3A5B] shadow-[0_0_0_5px_rgba(109,58,91,0.08)]"
                            : isCompleted
                              ? "border-[#6D3A5B] bg-[#6D3A5B]"
                              : "border-[#E9E1E4]"
                        }`}
                      >
                        {isCompleted ? (
                          <Check size={15} strokeWidth={2.8} className="text-white" />
                        ) : isCurrent ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-[#6D3A5B]" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#D5CDD1]" />
                        )}
                      </span>

                      <span className="sm:mt-3">
                        <span className={`block text-[12px] font-semibold ${isCurrent ? "text-[#6D3A5B]" : isCompleted ? "text-[#211C1F]" : "text-[#9A9196]"}`}>
                          {phase}
                        </span>
                        <span className="mt-1 block text-[10px] text-[#9A9196]">
                          {isCurrent ? "Current phase" : isCompleted ? "Completed" : "Upcoming"}
                        </span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 rounded-[15px] bg-[#FBF8F7] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">Selected phase</p>
                <p className="mt-1 text-[13px] font-semibold text-[#211C1F]">{selectedPhase}</p>
              </div>
              <p className="text-left text-[11px] text-[#756D72] sm:text-right">
                {phaseDetails[selectedPhase].focus}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[22px] border border-[#E9E1E4] bg-white p-6 shadow-[0_8px_30px_rgba(33,28,31,0.035)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Current phase</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#211C1F]">Pregnancy</h2>
                <span className="rounded-full bg-[#F3EAF0] px-3 py-1.5 text-[10px] font-semibold text-[#6D3A5B]">Current phase</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#756D72]">
                Keep appointments, shared responsibilities and approved care information coordinated with the people you trust.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-[#EEF5F0] px-3 py-2 text-[10px] font-semibold text-[#4F8068]">
              <CheckCircle2 size={14} />
              Coordination in progress
            </div>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            <CoordinationArea icon={<CalendarDays size={17} />} title="Appointments" text="Keep upcoming visits visible to the people you&apos;ve approved." />
            <CoordinationArea icon={<ListChecks size={17} />} title="Responsibilities" text="Know who is handling shared tasks." />
            <CoordinationArea icon={<FileCheck2 size={17} />} title="Care updates" text="Review information before it is shared with your Care Circle." />
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Phase details</p>
              <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">Coordination across each stage</h2>
            </div>
            <span className="hidden text-[10px] text-[#9A9196] sm:block">Planning view</span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {phases.map((phase, index) => {
              const Icon = phaseIcons[phase];
              const isSelected = phase === selectedPhase;
              const isCurrent = phase === "Pregnancy";

              return (
                <motion.button
                  key={phase}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedPhase(phase)}
                  className={`text-left rounded-[18px] border bg-white p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)] transition ${isSelected ? "border-[#B98FA5] ring-2 ring-[#F3EAF0]" : "border-[#E9E1E4] hover:border-[#D7C2CD]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${isCurrent ? "bg-[#F3EAF0] text-[#6D3A5B]" : "bg-[#FBF8F7] text-[#756D72]"}`}><Icon size={17} /></div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${isCurrent ? "bg-[#F3EAF0] text-[#6D3A5B]" : index === 0 ? "bg-[#EEF5F0] text-[#4F8068]" : "bg-[#F5F1F3] text-[#9A9196]"}`}>
                      {isCurrent ? "Current" : index === 0 ? "Completed" : "Upcoming"}
                    </span>
                  </div>

                  <h3 className="mt-5 text-sm font-semibold text-[#211C1F]">{phase}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-[#756D72]">{phaseDetails[phase].focus}</p>

                  <ul className="mt-4 space-y-2">
                    {phaseDetails[phase].examples.map((example) => (
                      <li key={example} className="flex items-start gap-2 text-[10px] leading-4 text-[#756D72]">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#B86B87]" />
                        {example}
                      </li>
                    ))}
                  </ul>
                </motion.button>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Current coordination snapshot</p>
              <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">What is moving now</h2>
            </div>
            <Clock3 size={17} className="text-[#9A9196]" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <SnapshotLink href="/timeline" icon={<CalendarDays size={17} />} label="Next appointment">
              <strong className="block text-sm font-semibold text-[#211C1F]">28 Sep · 10:30 AM</strong>
              <span className="mt-1 block text-[11px] text-[#756D72]">Dr. Meera Sharma</span>
              <span className="mt-1 block text-[10px] text-[#9A9196]">City Women&apos;s Clinic</span>
            </SnapshotLink>

            <SnapshotLink href="/tasks" icon={<ListChecks size={17} />} label="Open coordination tasks">
              <strong className="block text-2xl font-semibold tracking-[-0.03em] text-[#211C1F]">4</strong>
              <span className="mt-1 block text-[11px] text-[#756D72]">Shared responsibilities to keep moving</span>
            </SnapshotLink>

            <SnapshotLink href="/handoffs" icon={<ArrowRight size={17} />} label="Active care handoff">
              <strong className="block text-sm font-semibold text-[#211C1F]">Appointment coordination</strong>
              <span className="mt-1 block text-[11px] text-[#756D72]">Rahul Rao → Lakshmi Rao</span>
            </SnapshotLink>
          </div>
        </section>

        <section className="mt-8 rounded-[18px] border border-[#E4D7DF] bg-[#F8F2F6] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#6D3A5B]" />
              <div>
                <h2 className="text-sm font-semibold text-[#211C1F]">Your journey, your control</h2>
                <p className="mt-2 max-w-3xl text-[11px] leading-5 text-[#756D72]">
                  MaatruCare helps organize shared care coordination across different stages of motherhood. You decide what information is shared with your Care Circle.
                </p>
              </div>
            </div>

            <Link href="/consent" className="flex shrink-0 items-center justify-center gap-2 rounded-[13px] border border-[#D8C5D0] bg-white px-4 py-3 text-xs font-semibold text-[#6D3A5B] transition hover:bg-[#F3EAF0]">
              Manage sharing
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function CoordinationArea({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[16px] bg-[#FBF8F7] p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#6D3A5B]">{icon}</div>
      <h3 className="mt-4 text-xs font-semibold text-[#211C1F]">{title}</h3>
      <p className="mt-1.5 text-[10px] leading-4 text-[#756D72]">{text}</p>
    </div>
  );
}

function SnapshotLink({
  href,
  icon,
  label,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group rounded-[18px] border border-[#E9E1E4] bg-white p-5 shadow-[0_6px_24px_rgba(33,28,31,0.025)] transition hover:-translate-y-0.5 hover:border-[#D7C2CD]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F4EDF1] text-[#6D3A5B]">{icon}</div>
        <ArrowRight size={15} className="text-[#9A9196] transition group-hover:translate-x-0.5 group-hover:text-[#6D3A5B]" />
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">{label}</p>
      <div className="mt-2">{children}</div>
    </Link>
  );
}