import type { ApiAuthAccount, ApiCaregiver } from "./api";

export function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function shiftDate(date: string, delta: number) {
  const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + delta);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export function recentDates(end: string, count = 7) { return Array.from({ length: count }, (_, index) => shiftDate(end, index - count + 1)); }
export function displayTimestamp(value?: string | null) { return value ? new Date(/[Z+]|-\d\d:\d\d$/.test(value.slice(10)) ? value : `${value}Z`).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Not recorded"; }
export function participantOptions(account: ApiAuthAccount | null, members: ApiCaregiver[]) {
  return [
    ...(account?.patient_id ? [{ value: `patient:${account.patient_id}`, label: account.patient?.name ?? "Care Circle owner", secondary: account.role === "patient" ? "You" : "Care Circle owner", simulated: false }] : []),
    ...members.map((member) => ({ value: `caregiver:${member.id}`, label: member.name, secondary: member.relationship + (members.filter((other) => other.name.toLowerCase() === member.name.toLowerCase()).length > 1 && member.email ? ` - ${member.email}` : ""), simulated: member.is_demo })),
  ];
}
export function optionLabel(option: { label: string; secondary: string; simulated: boolean }) { return `${option.label} — ${option.secondary}${option.simulated ? " · Simulated" : ""}`; }
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const escape = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const url = URL.createObjectURL(new Blob(["\uFEFF", [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export function caregiverLabel(member: Pick<ApiCaregiver, "name" | "relationship" | "is_demo" | "email">, members: ApiCaregiver[]) {
  const duplicate = members.filter((other) => other.name.toLowerCase() === member.name.toLowerCase()).length > 1;
  return `${member.name} - ${member.relationship}${duplicate && member.email ? ` - ${member.email}` : ""}${member.is_demo ? " - Simulated" : ""}`;
}
