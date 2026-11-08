import type { ApiAppointment } from "./api";
import type { DemoHandoff, DemoTask } from "../context/MaatruCareDemoContext";

/** Dates are the user's local calendar dates; no health/risk assessment is made. */
export function carePulse(tasks: DemoTask[], handoffs: DemoHandoff[], appointments: ApiAppointment[], today: string, currentTime = "00:00") {
  const open = tasks.filter(item => item.status !== "Completed").sort((a, b) => a.dueDate.localeCompare(b.dueDate) || Number(a.id) - Number(b.id));
  const waiting = handoffs.filter(item => item.stage === "Sent" && !item.archivedAt);
  const upcoming = appointments.filter(item => !["Cancelled", "Completed"].includes(item.status) && (item.appointment_date > today || item.appointment_date === today && item.appointment_time.slice(0, 5) >= currentTime.slice(0, 5)))
    .sort((a, b) => `${a.appointment_date}T${a.appointment_time}`.localeCompare(`${b.appointment_date}T${b.appointment_time}`));
  return {
    open, waiting, upcoming,
    overdue: open.filter(item => item.dueDate < today),
    dueToday: open.filter(item => item.dueDate === today),
    later: open.filter(item => item.dueDate > today),
  };
}
