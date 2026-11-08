"use client";

import AppShell from "@/components/layout/AppShell";
import { Button, Drawer, Field, Message } from "@/components/ui/ProductUI";
import { api, type ApiAppointment, type ApiIdentity } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, Clock3, FileText, MapPin, Pencil, Plus, ShieldCheck } from "lucide-react";

type AppointmentForm = { title: string; clinician_name: string; location: string; appointment_date: string; appointment_time: string };
type FormMode = { kind: "create" } | { kind: "edit"; id: number };
const emptyForm: AppointmentForm = { title: "Clinic visit", clinician_name: "", location: "", appointment_date: "", appointment_time: "" };

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(value: string) { return value.slice(0, 5); }

function localToday() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export default function AppointmentsPage() {
  const { account } = useAuth();
  const identity = useMemo<ApiIdentity | null>(() => account?.patient_id && account.caregiver_id
    ? { patientId: account.patient_id, caregiverId: account.caregiver_id }
    : null, [account]);
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [form, setForm] = useState<AppointmentForm>(emptyForm);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ApiAppointment | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const savingLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadAppointments = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      if (!identity) return false;
      setAppointments(await api.getAppointments(identity));
      setError("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load appointments.");
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    const handle = window.setTimeout(() => { void loadAppointments(true); }, 0);
    return () => window.clearTimeout(handle);
  }, [loadAppointments]);

  function beginCreate() {
    setForm(emptyForm);
    setFormMode({ kind: "create" });
    setFeedback(null);
  }

  function beginEdit(appointment: ApiAppointment) {
    setForm({ title: appointment.title, clinician_name: appointment.clinician_name, location: appointment.location, appointment_date: appointment.appointment_date, appointment_time: appointment.appointment_time.slice(0, 5) });
    setFormMode({ kind: "edit", id: appointment.id });
    setFeedback(null);
  }

  async function saveAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formMode || savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setFeedback(null);
    setError("");
    try {
      if (!identity) throw new Error("Finish setting up your care workspace to continue.");
      const payload = {
        ...form,
        title: form.title.trim(),
        clinician_name: form.clinician_name.trim(),
        location: form.location.trim(),
        actor_caregiver_id: identity.caregiverId,
      };
      if (formMode.kind === "edit") {
        await api.updateAppointment(formMode.id, payload);
      } else {
        await api.createAppointment({ ...payload, patient_id: identity.patientId, status: "Confirmed" });
      }
      const refreshed = await loadAppointments();
      setFormMode(null);
      setFeedback({ kind: "success", message: refreshed ? "Appointment saved." : "Appointment saved, but the list could not be refreshed." });
    } catch (cause) {
      setFeedback({ kind: "error", message: cause instanceof Error ? cause.message : "Unable to save appointment." });
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  async function confirmCancellation() {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    setFeedback(null);
    try {
      if (!identity) throw new Error("Finish setting up your care workspace to continue.");
      await api.cancelAppointment(cancelTarget.id, identity);
      const refreshed = await loadAppointments();
      setCancelTarget(null);
      setFeedback({ kind: "success", message: refreshed ? "Appointment cancelled." : "Appointment cancelled, but the list could not be refreshed." });
    } catch (cause) {
      setFeedback({ kind: "error", message: cause instanceof Error ? cause.message : "Unable to cancel appointment." });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <AppShell>
      <div>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">Appointment coordination</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#211C1F]">Appointment details</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#756D72]">Plan visits and keep their logistics together. Times use the local time entered by your care team.</p></div>
          <button type="button" onClick={beginCreate} className="flex items-center justify-center gap-2 rounded-[13px] bg-[#6D3A5B] px-4 py-2.5 text-xs font-semibold text-white"><Plus size={15} />Add appointment</button>
        </div>

        {feedback && <div role={feedback.kind === "error" ? "alert" : "status"} className={`mt-5 rounded-[12px] border px-3 py-2 text-xs font-medium ${feedback.kind === "error" ? "border-[#E7C8CC] bg-[#FFF5F5] text-[#9D4B55]" : "border-[#CFE0D5] bg-[#F1F8F3] text-[#3F6D56]"}`}>{feedback.message}</div>}
        {error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E7C8CC] bg-[#FFF5F5] px-3 py-2 text-xs font-medium text-[#9D4B55]"><span>{error}</span><button type="button" onClick={() => void loadAppointments(true)} className="rounded-[9px] border border-[#E7C8CC] px-3 py-1.5">Retry</button></div>}

        {loading ? <div role="status" className="mt-8 rounded-[22px] border border-[#E9E1E4] bg-white p-8 text-sm text-[#756D72]">Loading appointments...</div> : appointments.length === 0 ? <div className="mt-8 rounded-[22px] border border-dashed border-[#D8C5D0] bg-white p-10 text-center"><CalendarDays className="mx-auto text-[#6D3A5B]" size={24} /><p className="mt-3 text-sm font-semibold text-[#211C1F]">No appointments yet</p><p className="mt-2 text-xs text-[#756D72]">Create an appointment to coordinate a visit.</p></div> : <div className="mt-8 space-y-4">{appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} onEdit={() => beginEdit(appointment)} onCancel={() => setCancelTarget(appointment)} onCopy={() => { const summary = `${appointment.title} ? ${formatDate(appointment.appointment_date)}, ${formatTime(appointment.appointment_time)}. ${appointment.clinician_name}. Location: ${appointment.location}. Status: ${appointment.status}.`; void navigator.clipboard.writeText(summary).then(() => setFeedback({ kind: "success", message: "Appointment summary copied. No message was sent." })).catch(() => setFeedback({ kind: "error", message: "The summary could not be copied. Check clipboard permissions." })); }} />)}</div>}

        <div className="mt-6 flex gap-3 rounded-[16px] bg-[#FBF8F7] p-4"><ShieldCheck size={16} className="shrink-0 text-[#6D3A5B]" /><p className="text-[11px] leading-5 text-[#756D72]">MaatruCare coordinates appointments and responsibilities. It does not diagnose conditions, interpret clinical results, or make treatment decisions.</p></div>
      </div>

      {formMode && <AppointmentEditor mode={formMode.kind} form={form} setForm={setForm} saving={saving} error={feedback?.kind === "error" ? feedback.message : undefined} onClose={() => setFormMode(null)} onSubmit={saveAppointment} />}
      {cancelTarget && <CancelConfirmation appointment={cancelTarget} cancelling={cancelling} error={feedback?.kind === "error" ? feedback.message : undefined} onClose={() => setCancelTarget(null)} onConfirm={confirmCancellation} />}
    </AppShell>
  );
}

function AppointmentCard({ appointment, onEdit, onCancel, onCopy }: { appointment: ApiAppointment; onEdit: () => void; onCancel: () => void; onCopy: () => void }) {
  const date = new Date(`${appointment.appointment_date}T00:00:00`);
  const month = Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { month: "short" });
  const day = Number.isNaN(date.getTime()) ? "—" : String(date.getDate());
  const past = appointment.appointment_date < localToday();
  return <section className="rounded-[22px] border border-[#E4D7DF] bg-[#F8F2F6] p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-4"><div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[16px] bg-[#6D3A5B] text-white"><span className="text-[10px] uppercase opacity-80">{month}</span><span className="text-2xl font-semibold">{day}</span></div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9A9196]">{past ? "Past appointment" : "Appointment"} · {formatDate(appointment.appointment_date)} · {formatTime(appointment.appointment_time)}</p><h2 className="mt-1 truncate text-xl font-semibold text-[#211C1F]">{appointment.title}</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-[#756D72]"><MapPin size={13} />{appointment.location}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={onCopy}>Copy summary</Button><button type="button" onClick={onEdit} className="flex items-center gap-2 rounded-[12px] bg-[#6D3A5B] px-3.5 py-2.5 text-xs font-semibold text-white"><Pencil size={14} />Edit</button>{appointment.status !== "Cancelled" && <button type="button" onClick={onCancel} className="rounded-[12px] border border-[#D8C5D0] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#9D4B55]">Cancel</button>}</div></div><div className="mt-6 grid gap-3 border-t border-[#E4D7DF] pt-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Date" value={formatDate(appointment.appointment_date)} icon={<CalendarDays size={15} />} /><Detail label="Time" value={formatTime(appointment.appointment_time)} icon={<Clock3 size={15} />} /><Detail label="Clinician" value={appointment.clinician_name} icon={<FileText size={15} />} /><Detail label="Status" value={appointment.status} icon={<CheckCircle2 size={15} />} /></div></section>;
}

function AppointmentEditor({ mode, form, setForm, saving, error, onClose, onSubmit }: { mode: FormMode["kind"]; form: AppointmentForm; setForm: (form: AppointmentForm) => void; saving: boolean; error?: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const fields: Array<[string, keyof AppointmentForm, "text" | "date" | "time"]> = [["Title", "title", "text"], ["Clinician", "clinician_name", "text"], ["Location", "location", "text"], ["Date", "appointment_date", "date"], ["Local time", "appointment_time", "time"]];
  return <Drawer title={mode === "edit" ? "Edit appointment" : "Add appointment"} onClose={() => { if (!saving) onClose(); }}><form onSubmit={onSubmit}><fieldset disabled={saving}>{fields.map(([label, key, type]) => <Field key={key} label={label}><input required maxLength={255} type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></Field>)}<Message error>{error}</Message><Button type="submit" disabled={saving}>{saving ? "Saving..." : mode === "edit" ? "Save changes" : "Create appointment"}</Button></fieldset></form></Drawer>;
}

function CancelConfirmation({ appointment, cancelling, error, onClose, onConfirm }: { appointment: ApiAppointment; cancelling: boolean; error?: string; onClose: () => void; onConfirm: () => void }) {
  return <Drawer title="Cancel this appointment?" onClose={() => { if (!cancelling) onClose(); }}><p className="mc-caption">Cancel &quot;{appointment.title}&quot; with {appointment.clinician_name}? The appointment remains in your history.</p><Message error>{error}</Message><div className="mt-6 flex flex-wrap gap-2"><Button variant="secondary" disabled={cancelling} onClick={onClose}>Keep appointment</Button><Button variant="danger" disabled={cancelling} onClick={onConfirm}>{cancelling ? "Cancelling..." : "Confirm cancel"}</Button></div></Drawer>;
}

function Detail({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="flex items-center gap-2 rounded-[13px] bg-white/60 p-3"><span className="text-[#6D3A5B]">{icon}</span><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9A9196]">{label}</p><p className="mt-1 truncate text-[11px] font-medium text-[#211C1F]">{value}</p></div></div>;
}
