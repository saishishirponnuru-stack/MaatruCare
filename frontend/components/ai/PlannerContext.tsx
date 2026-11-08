"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type CoordinationFacts } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMaatruCareDemo } from "@/context/MaatruCareDemoContext";
import { Button, Message, Panel } from "@/components/ui/ProductUI";

export default function PlannerContext({ onBrief, disabled }: { onBrief: (note: string) => void; disabled: boolean }) {
  const { account } = useAuth();
  const { tasks, handoffs, permissions } = useMaatruCareDemo();
  const [facts, setFacts] = useState<CoordinationFacts | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState("");
  const revision = JSON.stringify([account?.subject, version, tasks.map(item => [item.id, item.title, item.ownerKey, item.status, item.dueDate]), handoffs.map(item => [item.id, item.stage]), permissions]);
  useEffect(() => {
    if (!account?.patient_id || !account.caregiver_id) return;
    let active = true;
    void api.getCoordinationFacts({ patientId: account.patient_id, caregiverId: account.caregiver_id }).then(result => {
      if (active) { setFacts(result); setError(""); setLoaded(revision); }
    }).catch(() => { if (active) { setError("Your planning context could not be loaded. Retry before preparing a plan."); setLoaded(revision); } });
    return () => { active = false; };
  }, [account, revision]);
  const ready = loaded === revision;
  function brief(kind: "week" | "appointment" | "handoffs") {
    if (!facts || !ready || error) return;
    const appointment = facts.appointments[0];
    const context = `Non-clinical coordination planning brief. ${facts.available_categories.includes("Coordination tasks") ? `${facts.tasks.length} open responsibilities are already recorded; do not duplicate them.` : "Task information is not shared; existing responsibilities are unknown."} ${facts.available_categories.includes("Care handoffs") ? `${facts.handoffs.filter(item => item.status === "Awaiting acknowledgement").length} handoffs await acknowledgement.` : "Handoff information is not shared; its status is unknown."}`;
    const request = kind === "appointment"
      ? !facts.available_categories.includes("Appointments") ? "Appointment information is not shared. Ask for the visit date and logistical details rather than assuming there is no appointment." : appointment ? `The next recorded visit is on ${appointment.date} at ${appointment.time.slice(0, 5)}. Suggest optional logistical preparation and questions to confirm with the clinic. Requirements and transport ownership are not specified.` : "No upcoming appointment is recorded. Identify the information needed before proposing visit-specific tasks."
      : kind === "handoffs" ? "Help organize follow-up on waiting acknowledgements. Recipient availability and response times are not specified."
      : "Help organize responsibilities for this week. Use only new responsibilities I add below; ask for missing information rather than inventing tasks or dates.";
    onBrief(`${context}\n${request}\nAdditional fictional or de-identified responsibilities: `);
  }
  return <Panel title="AI Care Planner" className="mb-5" description={`Welcome, ${account?.name?.split(/\s+/)[0] || "there"}. Start with your saved responsibilities, then review a note before asking Gemini for suggestions.`}>
    <Message error>{error}</Message>
    {!ready ? <p role="status" className="mc-caption">Loading your authorized planning context…</p> : facts && !error && <div className="grid gap-4 md:grid-cols-3">
      <div><h3 className="text-sm font-semibold">Open responsibilities</h3>{facts.available_categories.includes("Coordination tasks") ? <><p className="mc-caption mt-2">{facts.tasks.length} recorded</p>{facts.tasks.slice(0, 3).map(item => <p key={item.id} className="mc-caption mt-2 break-words">{item.title} · {item.owner} · {item.due_date}</p>)}</> : <p className="mc-caption mt-2">Not shared with this account.</p>}<Link prefetch={false} href="/tasks" className="mc-caption mt-3 inline-block underline">Review Tasks</Link></div>
      <div><h3 className="text-sm font-semibold">Next appointment</h3><p className="mc-caption mt-2">{!facts.available_categories.includes("Appointments") ? "Not shared with this account." : facts.appointments[0] ? `${facts.appointments[0].title} · ${facts.appointments[0].date} at ${facts.appointments[0].time.slice(0, 5)}` : "No upcoming appointment is recorded."}</p><Link prefetch={false} href="/appointments" className="mc-caption mt-3 inline-block underline">Review Appointments</Link></div>
      <div><h3 className="text-sm font-semibold">Waiting handoffs</h3><p className="mc-caption mt-2">{facts.available_categories.includes("Care handoffs") ? `${facts.handoffs.filter(item => item.status === "Awaiting acknowledgement").length} awaiting acknowledgement` : "Not shared with this account."}</p><Link prefetch={false} href="/handoffs" className="mc-caption mt-3 inline-block underline">Review Handoffs</Link></div>
    </div>}
    <p className="mc-caption mt-4">This context stays in MaatruCare. A planning brief includes only counts and an appointment date/time; names, record titles and contact details are not copied. Review and de-identify the note before sending it.</p>
    <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" disabled={disabled || !ready || Boolean(error)} onClick={() => brief("week")}>Organize this week</Button><Button variant="secondary" disabled={disabled || !ready || Boolean(error)} onClick={() => brief("appointment")}>Prepare for my next visit</Button><Button variant="secondary" disabled={disabled || !ready || Boolean(error)} onClick={() => brief("handoffs")}>Review waiting handoffs</Button><Button variant="secondary" disabled={disabled || !ready} onClick={() => setVersion(value => value + 1)}>Refresh context</Button></div>
  </Panel>;
}
