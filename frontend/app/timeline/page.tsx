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
import { useMaatruCareDemo, type DemoTimelineEvent } from "@/context/MaatruCareDemoContext";
import { api } from "@/lib/api";

const TIMELINE_PAGE_SIZE = 15;

const filters = [
  "All",
  "Appointments",
  "Care updates",
  "Coordination",
  "Tasks",
] as const;

type Filter = (typeof filters)[number];
type EventType = "Appointment" | "Care update" | "Coordination" | "Task";

type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  type: EventType;
  source?: string;
  person?: string;
  time?: string;
  description?: string;
  status?: string;
};

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
  const [filter, setFilter] = useState<Filter>("All");
  const [additionalEvents, setAdditionalEvents] = useState<DemoTimelineEvent[]>([]);
  const [hasMoreOverride, setHasMoreOverride] = useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const events = useMemo(() => {
    const merged = new Map([...timeline, ...additionalEvents].map((event) => [event.id, event]));
    return Array.from(merged.values());
  }, [additionalEvents, timeline]);
  const hasMore = hasMoreOverride ?? timeline.length === TIMELINE_PAGE_SIZE;

  const visibleEvents = useMemo(() => {
    const sharedEvents: TimelineEvent[] = events.map((event) => {
      const title = event.title.toLowerCase();
      const validTypes: EventType[] = ["Appointment", "Care update", "Coordination", "Task"];
      const type = validTypes.includes(event.eventType as EventType)
        ? event.eventType as EventType
        : /appointment|clinic visit/.test(title) ? "Appointment"
        : /task|documents folder/.test(title) ? "Task"
        : /sharing|care status|consent|verified/.test(title) ? "Care update"
        : "Coordination";

      return {
        id: event.id,
        date: event.eventDate,
        title: event.title,
        type,
        description: event.description,
        source: event.source,
        status: "Recorded",
      };
    });

    return sharedEvents
      .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id))
      .filter((event) => {
      if (filter === "All") return true;
      return event.type === filterToType[filter];
      });
  }, [events, filter]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await api.getTimeline(TIMELINE_PAGE_SIZE, events.length);
      setAdditionalEvents((current) => {
        const merged = new Map(current.map((event) => [event.id, event]));
        next.forEach((event) => merged.set(String(event.id), {
          id: String(event.id),
          title: event.title,
          description: event.description ?? event.event_type,
          time: new Date(event.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          eventDate: String(event.event_date).slice(0, 10),
          eventType: event.event_type,
          source: event.source ?? undefined,
        }));
        return Array.from(merged.values());
      });
      setHasMoreOverride(next.length === TIMELINE_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

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

        <div className="mt-6 flex flex-wrap gap-2">
          {filters.map((item) => {
            const isActive = filter === item;

            return (
              <button
                key={item}
                type="button"
                aria-pressed={isActive}
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
                {filter === "All" ? "All loaded events" : filter}
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
                Try another event filter or check back after more coordination activity is recorded.
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

                          {false ? (
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
          {visibleEvents.length > 0 && hasMore ? (
            <div className="mt-6 flex justify-center border-t border-[#F0E9EC] pt-5">
              <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="rounded-[12px] border border-[#E9E1E4] bg-white px-4 py-2.5 text-xs font-semibold text-[#6D3A5B] transition hover:bg-[#FBF8F7] disabled:cursor-wait disabled:opacity-60">
                {loadingMore ? "Loading history…" : "Load more"}
              </button>
            </div>
          ) : null}
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
