"use client";

import Link from "next/link";
import { useMaatruCareDemo } from "@/context/MaatruCareDemoContext";
import type { ApiAppointment } from "@/lib/api";
import { carePulse } from "@/lib/care-pulse";
import { todayLocal, displayTimestamp } from "@/lib/coordination";
import { Badge, Panel } from "@/components/ui/ProductUI";

export default function CarePulse({ appointments, appointmentError, appointmentLoading }: {
  appointments: ApiAppointment[]; appointmentError: string; appointmentLoading: boolean;
}) {
  const { tasks, handoffs, timeline, loading, taskError, handoffError, timelineError } = useMaatruCareDemo();
  const pulse = carePulse(tasks, handoffs, appointments, todayLocal(), new Date().toTimeString().slice(0, 5));
  const empty = !loading && !appointmentLoading && !taskError && !handoffError && !appointmentError && !tasks.length && !handoffs.length && !appointments.length;
  return <section aria-label="Care Pulse" className="mt-6">
    <Panel title="Care Pulse" description="Your daily coordination, ordered by overdue dates, today's responsibilities and what comes next.">
      {loading ? <p role="status" className="mc-caption animate-pulse">Gathering your saved responsibilities…</p> : <>
        {empty && <div className="mb-5"><h3 className="font-semibold">Your care journey starts here</h3><p className="mc-caption mt-2">Create your first task or invite someone you trust. Your saved activity will build this overview.</p></div>}
        <div className="grid gap-5 md:grid-cols-3">
          <div><h3 className="text-sm font-semibold">Needs attention</h3>{taskError ? <p role="alert" className="mc-caption mt-3">Tasks are unavailable or not shared.</p> : <><p className="mc-caption mt-2" data-testid="pulse-overdue">{pulse.overdue.length} overdue {pulse.overdue.length === 1 ? "task" : "tasks"}</p>{pulse.overdue.slice(0, 3).map(item => <PulseLink key={item.id} href="/tasks" title={item.title} detail={`Due ${item.dueDate} · ${item.owner}`} />)}</>}
            {handoffError ? <p className="mc-caption mt-3">Handoffs are unavailable or not shared.</p> : <><p className="mc-caption mt-3" data-testid="pulse-waiting">{pulse.waiting.length} awaiting acknowledgement</p>{pulse.waiting.slice(0, 2).map(item => <PulseLink key={item.id} href="/handoffs" title={item.title} detail={`Waiting for ${item.to}${item.toDemo ? " · Simulated" : ""}`} />)}</>}
          </div>
          <div><h3 className="text-sm font-semibold">Due today</h3>{taskError ? <p className="mc-caption mt-3">Open Tasks to retry.</p> : <><p className="mc-caption mt-2" data-testid="pulse-today">{pulse.dueToday.length} {pulse.dueToday.length === 1 ? "responsibility" : "responsibilities"}</p>{pulse.dueToday.slice(0, 4).map(item => <PulseLink key={item.id} href="/tasks" title={item.title} detail={`${item.owner} · ${item.status}`} />)}{!pulse.dueToday.length && <p className="mc-caption mt-3">No recorded tasks are due today.</p>}</>}</div>
          <div><h3 className="text-sm font-semibold">Coming up</h3>{appointmentLoading ? <p role="status" className="mc-caption mt-3">Loading appointments…</p> : appointmentError ? <p className="mc-caption mt-3">Appointments are unavailable or not shared.</p> : pulse.upcoming.slice(0, 2).map(item => <PulseLink key={item.id} href="/appointments" title={item.title} detail={`${item.appointment_date} · ${item.appointment_time.slice(0, 5)}`} />)}{!taskError && pulse.later.slice(0, 2).map(item => <PulseLink key={item.id} href="/tasks" title={item.title} detail={`Due ${item.dueDate} · ${item.owner}`} />)}{!pulse.upcoming.length && !pulse.later.length && !appointmentLoading && !appointmentError && !taskError && <p className="mc-caption mt-3">Nothing upcoming is recorded.</p>}</div>
        </div>
        <details className="mt-5 border-t border-[var(--mc-border)] pt-4"><summary className="cursor-pointer text-sm font-semibold">Recent Care Circle activity</summary>{timelineError ? <p className="mc-caption mt-3">Open Timeline to retry loading activity.</p> : timeline.length ? timeline.slice(0, 3).map(item => <div key={item.id} className="mt-3"><p className="text-sm">{item.title} {item.simulated && <Badge>Simulated</Badge>}</p><p className="mc-caption">{item.actor ? `${item.actor} · ` : ""}{displayTimestamp(item.timestamp)}</p></div>) : <p className="mc-caption mt-3">Saved activity will appear here.</p>}<Link prefetch={false} href="/timeline" className="mc-caption mt-3 inline-block underline">View all activity</Link></details>
      </>}
      <nav aria-label="Care Pulse actions" className="mt-5 flex flex-wrap gap-2 border-t border-[var(--mc-border)] pt-4">{[["/tasks", "Create task"], ["/handoffs", "View pending handoffs"], ["/care-circle", "Invite caregiver"], ["/lifestyle", "Record lifestyle activity"], ["/ai-assist?tool=care_plan", "Open AI Care Planner"]].map(([href, label]) => <Link prefetch={false} key={href} href={href} className="mc-button mc-button--secondary">{label}</Link>)}</nav>
    </Panel>
  </section>;
}

function PulseLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return <Link prefetch={false} href={href} className="mt-3 block rounded-xl border border-[var(--mc-border)] p-3 transition hover:border-[var(--mc-brand)]"><p className="break-words text-sm font-semibold">{title}</p><p className="mc-caption mt-1">{detail}</p></Link>;
}
