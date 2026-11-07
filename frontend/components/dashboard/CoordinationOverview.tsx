"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type CoordinationAnalytics, type LifestyleData } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button, Message, Panel, Stat } from "@/components/ui/ProductUI";
import { shiftDate, todayLocal } from "@/lib/coordination";

export default function CoordinationOverview() {
  const { account } = useAuth();
  const requestVersion = useRef(0);
  const [period, setPeriod] = useState(30);
  const [metrics, setMetrics] = useState<CoordinationAnalytics | null>(null);
  const [lifestyle, setLifestyle] = useState<LifestyleData | null>(null);
  const [error, setError] = useState("");
  const [lifestyleStatus, setLifestyleStatus] = useState("Loading lifestyle summary...");
  const end = todayLocal(); const start = shiftDate(end, -(period - 1));
  const load = useCallback(async () => {
    if (!account?.patient_id || !account.caregiver_id) return;
    const version = ++requestVersion.current;
    const identity = { patientId: account.patient_id, caregiverId: account.caregiver_id };
    const [statistics, records] = await Promise.allSettled([api.getAnalytics(identity, start, end), api.getLifestyle(identity)]);
    if (version !== requestVersion.current) return;
    if (statistics.status === "fulfilled") { setMetrics(statistics.value); setError(""); }
    else { setMetrics(null); setError("Coordination measures could not be loaded. Try again."); }
    if (records.status === "fulfilled") { setLifestyle(records.value); setLifestyleStatus(""); }
    else { setLifestyle(null); setLifestyleStatus(records.reason instanceof ApiError && records.reason.status === 403 ? "Lifestyle records are not shared with this account." : "Lifestyle summary is temporarily unavailable."); }
  }, [account, start, end]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const taskRate = metrics?.tasks && metrics.tasks.eligible ? `${Math.round(metrics.tasks.completed / metrics.tasks.eligible * 100)}%` : null;
  const ackRate = metrics?.handoffs && metrics.handoffs.sent ? `${Math.round(metrics.handoffs.acknowledged / metrics.handoffs.sent * 100)}%` : null;
  const todayWater = lifestyle?.water.filter((entry) => entry.log_date === end).reduce((sum, entry) => sum + (entry.quantity_ml ?? 0), 0);
  const sleep = lifestyle?.sleep[0];
  return <Panel title="Coordination at a glance" className="mt-6" description={`${start} to ${end}. Operational measures from your saved records.`} action={<select aria-label="Coordination measures time range" className="mc-input max-w-36" value={period} onChange={(event) => { ++requestVersion.current; setMetrics(null); setError(""); setPeriod(Number(event.target.value)); }}>{[7, 30, 90].map((days) => <option key={days} value={days}>{days} days</option>)}</select>}>
    {error ? <Message error>{error} <Button variant="secondary" onClick={() => void load()}>Retry</Button></Message> : !metrics ? <p role="status" className="mc-caption">Loading measures...</p> : <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Stat label="Task completion" value={!metrics.tasks ? "Not shared" : taskRate ?? "No eligible tasks"} detail={metrics.tasks ? `${metrics.tasks.completed} of ${metrics.tasks.eligible} created in period` : undefined} /><Stat label="Pending responsibilities" value={metrics.tasks?.pending ?? "Not shared"} detail="Currently open or in progress" /><Stat label="Overdue" value={metrics.tasks?.overdue ?? "Not shared"} detail="Unfinished and due before today" /><Stat label="Handoff acknowledgement" value={!metrics.handoffs ? "Not shared" : ackRate ?? "No sent handoffs"} detail={metrics.handoffs ? `${metrics.handoffs.acknowledged} of ${metrics.handoffs.sent} sent in period` : undefined} /></div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--mc-muted)]"><p>Accepted caregivers: <strong className="text-[var(--mc-text)]">{metrics.caregivers.accepted}</strong>{metrics.caregivers.simulated ? ` · ${metrics.caregivers.simulated} simulated` : ""}</p><p>Average real acknowledgement: <strong className="text-[var(--mc-text)]">{metrics.handoffs?.average_acknowledgement_minutes != null ? `${metrics.handoffs.average_acknowledgement_minutes} min` : "Not enough records"}</strong></p></div>
      <details className="mt-4"><summary className="mc-caption cursor-pointer">How these measures are calculated</summary><p className="mc-caption mt-2">Task completion uses the current status of tasks created in the selected period. Pending and overdue are current snapshots. Handoff acknowledgement includes acknowledged and completed records with a sent timestamp in the period. Average time includes real recipients with valid sent and acknowledgement timestamps only.</p><p className="mc-caption mt-2">{metrics.tasks?.simulated_tasks ?? 0} eligible task(s) are assigned to simulated participants; {metrics.handoffs?.simulated_acknowledgements ?? 0} acknowledgements in this period are simulations. These measures describe coordination, not validated clinical outcomes.</p></details>
    </>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mc-border)] pt-4"><p className="mc-caption">{lifestyle ? `Today: ${todayWater ?? 0} mL water. Latest entered sleep: ${sleep?.duration_hours != null ? `${Math.floor(sleep.duration_hours)}h ${Math.round(sleep.duration_hours % 1 * 60)}m (${sleep.log_date})` : "not recorded"}.` : lifestyleStatus}</p><Link href="/lifestyle" className="mc-caption text-[var(--mc-brand)] underline">Open lifestyle tracking</Link></div>
  </Panel>;
}
