"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMaatruCareDemo, type DemoHandoff } from "@/context/MaatruCareDemoContext";
import { api, type ApiTimelineEvent } from "@/lib/api";
import { displayTimestamp } from "@/lib/coordination";
import { Badge, Button, Message } from "@/components/ui/ProductUI";

export default function CoordinationStory({ handoff }: { handoff: DemoHandoff }) {
  const { account } = useAuth();
  const { tasks, taskError } = useMaatruCareDemo();
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<ApiTimelineEvent[]>([]);
  const [loaded, setLoaded] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const key = `${account?.subject}:${handoff.id}:${handoff.stage}:${handoff.archivedAt}:${retry}`;
  useEffect(() => {
    if (!expanded || !account?.patient_id || !account.caregiver_id) return;
    let active = true;
    void api.getTimeline({ patientId: account.patient_id, caregiverId: account.caregiver_id }, 100, 0,
      { order: "oldest", category: "Handoffs", resourceType: "CareHandoff", resourceId: Number(handoff.id) }).then(result => {
      if (active) { setEvents(result); setError(""); setLoaded(key); }
    }).catch(() => { if (active) { setError("This handoff's activity is unavailable or not shared with your account."); setLoaded(key); } });
    return () => { active = false; };
  }, [expanded, account, handoff.id, key]);
  const linkedTask = tasks.find(item => Number(item.id) === handoff.relatedTaskId);
  const steps = [
    { title: "Prepared", time: handoff.createdAt, detail: `Responsibility prepared for ${handoff.to}. Sending participant: ${handoff.from}.` },
    { title: "Sent", time: handoff.sentAt, detail: `Acknowledgement requested from ${handoff.to}.` },
    { title: "Acknowledged", time: handoff.acknowledgedAt, detail: handoff.toDemo ? "Acknowledgement recorded as a simulation." : "The receiving caregiver acknowledged." },
    { title: "Completed", time: handoff.completedAt, detail: handoff.toDemo ? "Completion recorded as a simulation." : "The receiving caregiver completed the handoff." },
  ];
  const closed = handoff.stage === "Cancelled" || Boolean(handoff.archivedAt);
  const next = closed ? "This handoff is retained in history."
    : handoff.stage === "Prepared" ? `${handoff.from} can send this handoff.`
    : handoff.stage === "Sent" ? `Waiting for ${handoff.to} to acknowledge${handoff.toDemo ? " (simulation available)" : ""}.`
    : handoff.stage === "Acknowledged" ? `${handoff.to} can complete the responsibility${handoff.toDemo ? " through a simulation" : ""}.`
    : "The handoff is complete. Any linked task keeps its own status.";
  return <section aria-label="Care Coordination Story" className="min-w-0 border-y border-[var(--mc-border)] py-5 [overflow-wrap:anywhere]">
    <h3 className="text-base font-semibold">Care Coordination Story</h3>
    <p className="mc-caption mt-2">{next}</p>
    <ol className="mc-action-timeline mt-5" aria-label="Handoff progress">{steps.map(step => <li key={step.title} className="mc-action-timeline__event" aria-current={!closed && handoff.stage === step.title ? "step" : undefined}>
      <span aria-hidden="true" className="mc-action-timeline__node">{step.time && <Check size={11} />}</span>
      <p className={`text-sm font-semibold ${!step.time ? "text-[var(--mc-muted)]" : ""}`}>{step.title}</p>
      {step.time ? <><time dateTime={step.time} className="mc-caption mt-1 block">{displayTimestamp(step.time)}</time><p className="mc-caption mt-1">{step.detail}</p></> : <p className="mc-caption mt-1">{closed ? "Not recorded" : "Upcoming"}</p>}
    </li>)}</ol>
    {handoff.relatedTaskId ? <div className="mt-4 rounded-xl bg-[var(--mc-surface-muted)] p-3"><h4 className="text-sm font-semibold">Linked responsibility</h4><p className="mc-caption mt-1">{taskError ? "Task details are not shared or could not be loaded." : linkedTask ? `${linkedTask.title} · ${linkedTask.owner} · ${linkedTask.status}` : "This task is no longer available."}</p>{linkedTask && <Link prefetch={false} href="/tasks" className="mc-caption mt-2 inline-block underline">Review linked task</Link>}</div> : <p className="mc-caption mt-4">No task is linked to this handoff.</p>}
    <details className="mt-4" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-semibold">Inspect recorded activity</summary>{expanded && <div className="mt-3">{loaded !== key ? <p role="status" className="mc-caption">Loading this handoff&apos;s history…</p> : error ? <><Message error>{error}</Message><Button variant="secondary" onClick={() => setRetry(value => value + 1)}>Retry history</Button></> : events.length ? <ol aria-label="Recorded handoff activity" className="space-y-3">{events.map(event => <li key={event.id} className="border-l border-[var(--mc-border)] pl-3"><p className="text-sm">{event.title} {event.simulated && <Badge>Simulated</Badge>}</p><p className="mc-caption mt-1">{event.actor_name || "Actor not recorded"} · <time dateTime={event.created_at}>{displayTimestamp(event.created_at)}</time></p><p className="mc-caption mt-1">{event.description}</p></li>)}</ol> : <p className="mc-caption">No linked activity is recorded.</p>}<Link prefetch={false} href="/timeline" className="mc-caption mt-4 inline-block underline">Open full activity timeline</Link></div>}</details>
  </section>;
}
