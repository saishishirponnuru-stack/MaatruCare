"use client";

import AppShell from "@/components/layout/AppShell";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Car,
  CheckSquare,
  Clock3,
  FileCheck2,
  FileText,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { useMaatruCareDemo } from "@/context/MaatruCareDemoContext";

const phases = [
  "Preconception",
  "Pregnancy",
  "Postnatal",
  "Early motherhood",
] as const;

const filters = [
  "All",
  "Appointments",
  "Care updates",
  "Coordination",
  "Tasks",
] as const;

type Phase = (typeof phases)[number];
type Filter = (typeof filters)[number];
type EventType = "Appointment" | "Care update" | "Coordination" | "Task";

type TimelineEvent = {
  id: string;
  phase: Phase;
  date: string;
  title: string;
  type: EventType;
  source?: string;
  person?: string;
  time?: string;
  description?: string;
  status?: string;
};

const events: TimelineEvent[] = [
  {
    id: "pre-1",
    phase: "Preconception",
    date: "2026-03-12",
    title: "Care Circle started",
    type: "Coordination",
    person: "Ananya Rao",
    description:
      "Trusted people were invited to help with appointments and shared responsibilities.",
    status: "Approved",
  },
  {
    id: "pre-2",
    phase: "Preconception",
    date: "2026-03-18",
    title: "Introductory clinic visit",
    type: "Appointment",
    person: "Dr. Meera Sharma",
    source: "City Women's Clinic",
    time: "11:00 AM",
    description: "Visit details were added to the shared coordination timeline.",
    status: "Completed",
  },
  {
    id: "pre-3",
    phase: "Preconception",
    date: "2026-03-20",
    title: "Sharing preferences set",
    type: "Care update",
    source: "Patient-controlled access",
    description:
      "Ananya chose what appointment and coordination information caregivers can see.",
    status: "Patient approved",
  },
  {
    id: "preg-1",
    phase: "Pregnancy",
    date: "2026-09-22",
    title: "Care status verified",
    type: "Care update",
    source: "City Women's Clinic",
    description:
      "Clinician-documented care status was reviewed and verified.",
    status: "Human verified",
  },
  {
    id: "preg-2",
    phase: "Pregnancy",
    date: "2026-09-28",
    title: "Next appointment",
    type: "Appointment",
    person: "Dr. Meera Sharma",
    source: "City Women's Clinic",
    time: "10:30 AM",
    description: "Maternal care visit coordinated with the Care Circle.",
    status: "Confirmed",
  },
  {
    id: "preg-3",
    phase: "Pregnancy",
    date: "2026-09-28",
    title: "Transport confirmed",
    type: "Coordination",
    person: "Lakshmi Rao",
    description: "Transport for the 28 September appointment is assigned.",
    status: "Assigned",
  },
  {
    id: "preg-4",
    phase: "Pregnancy",
    date: "2026-09-28",
    title: "Appointment documents",
    type: "Task",
    person: "Rahul Rao",
    description: "Keep approved documents ready for the upcoming visit.",
    status: "Open",
  },
  {
    id: "preg-5",
    phase: "Pregnancy",
    date: "2026-09-30",
    title: "Caregiver availability",
    type: "Coordination",
    person: "Priya Rao",
    description: "Confirm who can support around the scheduled visit.",
    status: "Open",
  },
  {
    id: "post-1",
    phase: "Postnatal",
    date: "2026-10-14",
    title: "Follow-up clinic visit",
    type: "Appointment",
    person: "Dr. Meera Sharma",
    source: "City Women's Clinic",
    time: "9:30 AM",
    description: "Scheduled visit kept in the shared coordination calendar.",
    status: "Upcoming",
  },
  {
    id: "post-2",
    phase: "Postnatal",
    date: "2026-10-14",
    title: "Home support rota",
    type: "Coordination",
    person: "Lakshmi Rao",
    description: "Family caregivers aligned around transport and household help.",
    status: "Planned",
  },
  {
    id: "post-3",
    phase: "Postnatal",
    date: "2026-10-16",
    title: "Approved documents folder",
    type: "Task",
    person: "Rahul Rao",
    description: "Keep visit notes and shared paperwork in one place.",
    status: "Upcoming",
  },
  {
    id: "early-1",
    phase: "Early motherhood",
    date: "2026-11-04",
    title: "Routine clinic appointment",
    type: "Appointment",
    source: "City Women's Clinic",
    time: "10:00 AM",
    description: "Appointment time shared with approved caregivers.",
    status: "Upcoming",
  },
  {
    id: "early-2",
    phase: "Early motherhood",
    date: "2026-11-05",
    title: "Care Circle check-in",
    type: "Coordination",
    person: "Priya Rao",
    description: "Confirm who is available for errands and appointment support.",
    status: "Upcoming",
  },
  {
    id: "early-3",
    phase: "Early motherhood",
    date: "2026-11-06",
    title: "Sharing settings reviewed",
    type: "Care update",
    source: "Patient-controlled access",
    description:
      "Access to appointments and coordination updates can be changed at any time.",
    status: "Patient approved",
  },
];

const typeIcons = {
  Appointment: CalendarDays,
  "Care update": FileCheck2,
  Coordination: Users,
  Task: CheckSquare,
} as const;

const filterToType: Record<Exclude<Filter, "All">, EventType> = {
  Appointments: "Appointment",
  "Care updates": "Care update",
  Coordination: "Coordination",
  Tasks: "Task",
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export default function TimelinePage() {
  const { timeline } = useMaatruCareDemo();
  const [phase, setPhase] = useState<Phase>("Pregnancy");
  const [filter, setFilter] = useState<Filter>("All");

  const visibleEvents = useMemo(() => {
    const sharedEvents: TimelineEvent[] = timeline.map((event) => ({
      id: event.id,
      phase: "Pregnancy",
      date: "2026-09-24",
      title: event.title,
      type: "Coordination",
      description: event.description,
      status: "Recorded",
    }));

    return [...sharedEvents, ...events].filter((event) => {
      if (event.phase !== phase) return false;
      if (filter === "All") return true;
      return event.type === filterToType[filter];
    });
  }, [filter, phase, timeline]);

  return (
    <AppShell>
      <div>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
              Timeline
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">
              Care timeline
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">
              See important appointments, care updates and shared
              responsibilities in context.
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-[#E9E1E4] bg-white px-3.5 py-2">
            <ShieldCheck size={14} className="text-[#6D3A5B]" />
            <span className="max-w-[260px] text-[10px] font-medium leading-4 text-[#756D72] sm:max-w-none">
              Only information you have approved is shared with your Care
              Circle.
            </span>
          </div>
        </div>

        <section className="mt-8 overflow-hidden rounded-[22px] border border-[#E9E1E4] bg-white p-4 shadow-[0_8px_30px_rgba(33,28,31,0.035)] sm:p-5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
            Journey phase
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {phases.map((item) => {
              const isActive = phase === item;

              return (
                <button
                  key={item}
                  onClick={() => setPhase(item)}
                  className={`rounded-[13px] px-3 py-2.5 text-[12px] font-semibold transition ${
                    isActive
                      ? "bg-[#6D3A5B] text-white"
                      : "bg-[#FBF8F7] text-[#756D72] hover:bg-[#F3EAF0] hover:text-[#6D3A5B]"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          {filters.map((item) => {
            const isActive = filter === item;

            return (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-3.5 py-2 text-[11px] font-semibold transition ${
                  isActive
                    ? "bg-[#6D3A5B] text-white"
                    : "border border-[#E9E1E4] bg-white text-[#756D72] hover:bg-[#FBF8F7]"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <section className="mt-6 rounded-[22px] border border-[#E9E1E4] bg-white px-5 py-6 shadow-[0_8px_30px_rgba(33,28,31,0.035)] sm:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
                {phase}
              </p>
              <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">
                Coordination in order
              </h2>
            </div>

            <span className="rounded-full bg-[#F3EAF0] px-3 py-1.5 text-[11px] font-semibold text-[#6D3A5B]">
              {visibleEvents.length} events
            </span>
          </div>

          {visibleEvents.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-[#211C1F]">
                No events in this view
              </p>
              <p className="mt-2 text-xs leading-5 text-[#756D72]">
                Try another phase or filter to see approved coordination
                activity.
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute bottom-4 left-[15px] top-4 w-px bg-[#E9E1E4] sm:left-[19px]" />

              <div className="space-y-4">
                {visibleEvents.map((event, index) => {
                  const Icon = typeIcons[event.type];

                  return (
                    <motion.article
                      key={event.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="relative grid gap-4 sm:grid-cols-[88px_minmax(0,1fr)]"
                    >
                      <div className="flex items-start gap-3 sm:block">
                        <div className="relative z-10 mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] border-[#6D3A5B] bg-white sm:mx-auto">
                          <div className="h-2 w-2 rounded-full bg-[#6D3A5B]" />
                        </div>

                        <p className="pt-5 text-[12px] font-semibold text-[#6D3A5B] sm:mt-2 sm:pt-0 sm:text-center">
                          {formatDate(event.date)}
                        </p>
                      </div>

                      <div className="rounded-[18px] border border-[#E9E1E4] bg-white p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F3EAF0] text-[#6D3A5B]">
                              <Icon size={16} />
                            </div>

                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-[#211C1F]">
                                {event.title}
                              </h3>

                              <p className="mt-1 text-[10px] text-[#9A9196]">
                                {event.person ?? event.source}
                                {event.person && event.source
                                  ? ` · ${event.source}`
                                  : ""}
                                {event.time ? ` · ${event.time}` : ""}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-full bg-[#F5F1F3] px-2.5 py-1 text-[9px] font-semibold text-[#756D72]">
                            {event.type}
                          </span>
                        </div>

                        {event.description ? (
                          <p className="mt-3 text-[11px] leading-5 text-[#756D72]">
                            {event.description}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {event.status ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${
                                event.status === "Human verified"
                                  ? "bg-[#EEF5F0] text-[#4F8068]"
                                  : event.status === "Confirmed" ||
                                      event.status === "Assigned"
                                    ? "bg-[#E8F0EB] text-[#4F8068]"
                                    : "bg-[#F3EAF0] text-[#6D3A5B]"
                              }`}
                            >
                              {event.status}
                            </span>
                          ) : null}

                          {event.type === "Appointment" && event.time ? (
                            <span className="flex items-center gap-1 text-[10px] text-[#9A9196]">
                              <Clock3 size={12} />
                              {event.time}
                            </span>
                          ) : null}

                          {event.type === "Coordination" && event.person ? (
                            <span className="flex items-center gap-1 text-[10px] text-[#9A9196]">
                              <Car size={12} />
                              Responsible
                            </span>
                          ) : null}

                          {event.type === "Task" && event.person ? (
                            <span className="flex items-center gap-1 text-[10px] text-[#9A9196]">
                              <FileText size={12} />
                              Responsible
                            </span>
                          ) : null}

                          {event.title === "Care status verified" ? (
                            <span className="flex items-center gap-1 text-[10px] text-[#9A9196]">
                              <UserRound size={12} />
                              Clinician-documented
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[20px] border border-[#E4D7DF] bg-[#F8F2F6] p-5">
          <p className="text-sm font-semibold text-[#211C1F]">
            Your timeline, your control
          </p>

          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#756D72]">
            Timeline information is organized from approved care and
            coordination activity. MaatruCare does not diagnose, interpret
            medical results, or make clinical decisions.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
