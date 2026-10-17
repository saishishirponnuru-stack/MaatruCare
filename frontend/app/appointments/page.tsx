"use client";

import AppShell from "@/components/layout/AppShell";
import { api, DEMO_ACTOR_CAREGIVER_ID, DEMO_PATIENT_ID, type ApiAppointment } from "@/lib/api";
import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, FileText, MapPin, Pencil, Plus, ShieldCheck, X } from "lucide-react";

type AppointmentForm = { title: string; clinician_name: string; location: string; appointment_date: string; appointment_time: string };
const emptyForm: AppointmentForm = { title: "Clinic visit", clinician_name: "", location: "", appointment_date: "", appointment_time: "" };

function formatDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); }
function formatTime(value: string) { return value.slice(0, 5); }

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAppointments() {
    setLoading(true);
    try { setAppointments(await api.getAppointments()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load appointments."); }
    finally { setLoading(false); }
  }

  useEffect(() => { const handle = window.setTimeout(() => { void loadAppointments(); }, 0); return () => window.clearTimeout(handle); }, []);

  const appointment = appointments[0];
  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(""), 2600); }
  function beginCreate() { setForm(emptyForm); setEditing(true); }
  function beginEdit() {
    if (!appointment) return;
    setForm({ title: appointment.title, clinician_name: appointment.clinician_name, location: appointment.location, appointment_date: appointment.appointment_date, appointment_time: appointment.appointment_time.slice(0, 5) });
    setEditing(true);
  }
  async function saveAppointment(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (appointment) await api.updateAppointment(appointment.id, { ...form, actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID });
      else await api.createAppointment({ ...form, patient_id: DEMO_PATIENT_ID, actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID, status: "Confirmed" });
      await loadAppointments(); setEditing(false); notify("Appointment saved.");
    } catch (cause) { notify(cause instanceof Error ? cause.message : "Unable to save appointment."); }
  }
  async function cancelAppointment() {
    if (!appointment) return;
    try { await api.cancelAppointment(appointment.id); await loadAppointments(); notify("Appointment cancelled."); }
    catch (cause) { notify(cause instanceof Error ? cause.message : "Unable to cancel appointment."); }
  }

  return <AppShell><div>
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Appointment coordination</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">Appointment details</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">Coordinate the people and logistics around your upcoming appointment.</p></div><button type="button" onClick={beginCreate} className="flex items-center justify-center gap-2 rounded-[13px] bg-[#6D3A5B] px-4 py-2.5 text-xs font-semibold text-white"><Plus size={15} />Add appointment</button></div>
    {feedback && <div className="mt-5 rounded-[12px] border border-[#CFE0D5] bg-[#F1F8F3] px-3 py-2 text-xs font-medium text-[#3F6D56]">{feedback}</div>}
    {error && <div className="mt-5 rounded-[12px] border border-[#E7C8CC] bg-[#FFF5F5] px-3 py-2 text-xs font-medium text-[#9D4B55]">{error}</div>}
    {loading ? <div className="mt-8 rounded-[22px] border border-[#E9E1E4] bg-white p-8 text-sm text-[#756D72]">Loading appointments...</div> : !appointment ? <div className="mt-8 rounded-[22px] border border-dashed border-[#D8C5D0] bg-white p-10 text-center"><CalendarDays className="mx-auto text-[#6D3A5B]" size={24} /><p className="mt-3 text-sm font-semibold text-[#211C1F]">No appointments yet</p><p className="mt-2 text-xs text-[#756D72]">Add an appointment to coordinate it with your Care Circle.</p></div> : <section className="mt-8 rounded-[22px] border border-[#E4D7DF] bg-[#F8F2F6] p-6"><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-4"><div className="flex h-16 w-16 flex-col items-center justify-center rounded-[16px] bg-[#6D3A5B] text-white"><span className="text-[10px] uppercase opacity-80">{new Date(`${appointment.appointment_date}T00:00:00`).toLocaleDateString("en-GB", { month: "short" })}</span><span className="text-2xl font-semibold">{new Date(`${appointment.appointment_date}T00:00:00`).getDate()}</span></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9A9196]">{formatDate(appointment.appointment_date)} · {formatTime(appointment.appointment_time)}</p><h2 className="mt-1 text-xl font-semibold text-[#211C1F]">{appointment.clinician_name}</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-[#756D72]"><MapPin size={13} />{appointment.location}</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={beginEdit} className="flex items-center gap-2 rounded-[12px] bg-[#6D3A5B] px-3.5 py-2.5 text-xs font-semibold text-white"><Pencil size={14} />Edit</button>{appointment.status !== "Cancelled" && <button type="button" onClick={() => void cancelAppointment()} className="rounded-[12px] border border-[#D8C5D0] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#9D4B55]">Cancel</button>}</div></div><div className="mt-6 grid gap-3 border-t border-[#E4D7DF] pt-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Date" value={formatDate(appointment.appointment_date)} icon={<CalendarDays size={15} />} /><Detail label="Time" value={formatTime(appointment.appointment_time)} icon={<Clock3 size={15} />} /><Detail label="Type" value={appointment.title} icon={<FileText size={15} />} /><Detail label="Status" value={appointment.status} icon={<CheckCircle2 size={15} />} /></div></section>}
    <div className="mt-6 flex gap-3 rounded-[16px] bg-[#FBF8F7] p-4"><ShieldCheck size={16} className="shrink-0 text-[#6D3A5B]" /><p className="text-[11px] leading-5 text-[#756D72]">MaatruCare coordinates appointments and responsibilities. It does not diagnose conditions, interpret clinical results, or make treatment decisions.</p></div>
    {editing && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-4 sm:items-center"><form onSubmit={saveAppointment} className="w-full max-w-md space-y-4 rounded-[18px] bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-[#211C1F]">{appointment ? "Edit appointment" : "Add appointment"}</h2><button type="button" onClick={() => setEditing(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F3F5]"><X size={17} /></button></div>{([["Title", "title", "text"], ["Clinician", "clinician_name", "text"], ["Location", "location", "text"], ["Date", "appointment_date", "date"], ["Time", "appointment_time", "time"]] as const).map(([label, key, type]) => <label key={key} className="block"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">{label}</span><input required type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-2 w-full rounded-[12px] border border-[#E9E1E4] px-3 py-2.5 text-xs outline-none focus:border-[#6D3A5B]" /></label>)}<button type="submit" className="w-full rounded-[13px] bg-[#6D3A5B] py-3 text-xs font-semibold text-white">Save appointment</button></form></div>}
  </div></AppShell>;
}

function Detail({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="flex items-center gap-2 rounded-[13px] bg-white/60 p-3"><span className="text-[#6D3A5B]">{icon}</span><div><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9A9196]">{label}</p><p className="mt-1 text-[11px] font-medium text-[#211C1F]">{value}</p></div></div>; }