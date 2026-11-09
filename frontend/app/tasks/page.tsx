"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Download, Plus, Search, CheckCircle2, Circle, Pencil } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge, Button, Drawer, Field, Message, PageHeading, Panel, Stat } from "@/components/ui/ProductUI";
import { useMaatruCareDemo, type DemoTask, type DemoCategory, type DemoTaskStatus } from "@/context/MaatruCareDemoContext";
import { useAuth } from "@/context/AuthContext";
import { downloadCsv, optionLabel, participantOptions, todayLocal } from "@/lib/coordination";

type Form = { title: string; ownerKey: string; dueDate: string; category: DemoCategory; note: string; priority: "Low" | "Normal" | "High"; status: DemoTaskStatus };
const blank: Form = { title: "", ownerKey: "", dueDate: "", category: "Coordination", note: "", priority: "Normal", status: "Open" };
const filters = ["All", "My tasks", "Open", "In progress", "Completed", "Overdue"];

export default function TasksPage() {
  const { account } = useAuth();
  const { tasks, caregiverRecords, addTask, updateTask, completeTask, deleteTask, loading, taskError: error, refreshData, permissions } = useMaatruCareDemo();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<DemoTask | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [feedback, setFeedback] = useState({ message: "", error: false });
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const today = todayLocal();
  const options = participantOptions(account, caregiverRecords);
  const ownKey = account?.role === "patient" ? `patient:${account.patient_id}` : `caregiver:${account?.caregiver_id}`;
  const canWrite = Boolean(account?.caregiver_id && permissions[account.caregiver_id]?.["Coordination tasks"]);
  const overdue = (task: DemoTask) => task.status !== "Completed" && task.dueDate < today;
  const visible = tasks.filter((task) => (!search || `${task.title} ${task.owner} ${task.note}`.toLowerCase().includes(search.toLowerCase())) && (filter === "All" || filter === "My tasks" && task.ownerKey === ownKey || filter === "Overdue" && overdue(task) || task.status === filter));

  async function mutate(action: () => Promise<unknown>, message: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFeedback({ message: "", error: false });
    try { await action(); setFeedback({ message, error: false }); setDrawer(null); }
    catch (cause) { setFeedback({ message: cause instanceof Error ? cause.message : "The change could not be saved.", error: true }); }
    finally { lock.current = false; setBusy(false); }
  }
  function edit(task: DemoTask) {
    setSelected(task); setForm({ title: task.title, ownerKey: task.ownerKey, dueDate: task.dueDate, note: task.note, category: task.category, priority: task.priority ?? "Normal", status: task.status }); setDrawer("edit");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const option = options.find((item) => item.value === form.ownerKey);
    if (!option || !form.title.trim() || !form.dueDate) { setFeedback({ message: "Enter a title, assignee and due date.", error: true }); return; }
    const payload = { ...form, title: form.title.trim(), owner: option.label };
    void mutate(() => drawer === "edit" && selected ? updateTask(selected.id, payload) : addTask(payload), drawer === "edit" ? "Task updated" : "Task created");
  }
  function exportTasks() {
    downloadCsv(`maatrucare-tasks-${today}.csv`, ["Title", "Assignee", "Participation", "Due date", "Status", "Category", "Priority", "Note"], visible.map((task) => [task.title, task.owner, task.ownerDemo ? "Simulated" : "Care Circle member", task.dueDate, task.status, task.category === "Patient" ? "Personal" : task.category, task.priority, task.note]));
  }

  return <AppShell><PageHeading title="Coordination tasks" description="Clear responsibilities, shared with the people you trust." action={<div className="flex gap-2"><Button variant="secondary" onClick={exportTasks} disabled={!visible.length}><Download size={16} />Export</Button><Button disabled={loading || !canWrite} onClick={() => { setSelected(null); setForm({ ...blank, dueDate: today, ownerKey: ownKey }); setDrawer("create"); }}><Plus size={16} />Add task</Button></div>} />
    <Message error={feedback.error}>{feedback.message}</Message>
    {error && <Message error>{error} <button type="button" onClick={() => void refreshData()} className="underline">Retry</button></Message>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Total tasks" value={loading ? "Loading" : error ? "Unavailable" : tasks.length} /><Stat label="Open responsibilities" value={loading ? "Loading" : error ? "Unavailable" : tasks.filter((task) => task.status !== "Completed").length} detail="Open and in progress" /><Stat label="Completed" value={loading ? "Loading" : error ? "Unavailable" : tasks.filter((task) => task.status === "Completed").length} /><Stat label="Overdue" value={loading ? "Loading" : error ? "Unavailable" : tasks.filter(overdue).length} detail="Due before today and unfinished" /></div>
    <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="mc-tabs m-0" aria-label="Task filters">{filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="mc-search-field w-full lg:w-64 lg:shrink-0"><Search size={16} aria-hidden="true" /><input aria-label="Search tasks" placeholder="Search responsibilities" value={search} onChange={(event) => setSearch(event.target.value)} className="mc-input" /></label></div>
    <Panel title={filter === "All" ? "Your responsibilities" : filter} className="mt-5" description={`${visible.length} matching task${visible.length === 1 ? "" : "s"}`}>
      {loading ? <p role="status" className="mc-caption">Loading tasks...</p> : !visible.length ? <div className="py-10 text-center"><h3 className="font-semibold">{tasks.length ? "No matching tasks" : "A little clarity starts here"}</h3><p className="mc-caption mt-2">{tasks.length ? "Change the filter or search to find a responsibility." : "Add a responsibility for yourself or an approved caregiver."}</p></div> : <div className="divide-y divide-[var(--mc-border)]">{visible.map((task) => <article key={task.id} className="flex items-start gap-3 py-5 first:pt-0 last:pb-0"><button aria-label={task.status === "Completed" ? `Reopen ${task.title}` : `Complete ${task.title}`} disabled={busy || !canWrite} onClick={() => void mutate(() => completeTask(task.id), task.status === "Completed" ? "Task reopened" : "Task completed")} className="mt-1 text-[var(--mc-success)]">{task.status === "Completed" ? <CheckCircle2 size={22} /> : <Circle size={22} />}</button><div className="min-w-0 flex-1"><button type="button" onClick={() => edit(task)} className={`text-left text-base font-semibold hover:text-[var(--mc-brand)] ${task.status === "Completed" ? "line-through text-[var(--mc-muted)]" : ""}`}>{task.title}</button><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--mc-muted)]"><span>{task.owner}</span>{task.ownerDemo && <Badge>Simulated</Badge>}<span>Due {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span><Badge tone={task.status === "Completed" ? "success" : overdue(task) ? "warning" : "neutral"}>{overdue(task) ? "Overdue" : task.status}</Badge><Badge>{task.category === "Patient" ? "Personal" : task.category}</Badge>{task.priority === "High" && <Badge tone="warning">High priority</Badge>}</div>{task.note && <p className="mc-caption mt-2 whitespace-pre-line">{task.note}</p>}</div><button className="mc-icon-button" aria-label={`Edit ${task.title}`} onClick={() => edit(task)}><Pencil size={16} /></button></article>)}</div>}
    </Panel>
    <p className="mc-caption mt-5">Need to transfer a responsibility with acknowledgement? <Link href="/handoffs" className="text-[var(--mc-brand)] underline">Create a care handoff</Link>.</p>
    {drawer && <Drawer title={drawer === "create" ? "Add coordination task" : "Task details"} onClose={() => { if (!busy) setDrawer(null); }}><form onSubmit={submit}><fieldset disabled={busy || !canWrite}>
      <Field label="Task title"><input required maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus /></Field>
      <Field label="Assign to"><select required value={form.ownerKey} onChange={(event) => setForm({ ...form, ownerKey: event.target.value })}>{!options.some((option) => option.value === form.ownerKey) && <option value={form.ownerKey}>Previous assignee - choose an active member</option>}{options.map((option) => <option key={option.value} value={option.value}>{optionLabel(option)}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Due date"><input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field><Field label="Priority"><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Form["priority"] })}>{["Low", "Normal", "High"].map((value) => <option key={value}>{value}</option>)}</select></Field></div>
      <Field label="Category"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as DemoCategory })}>{["Appointment", "Transport", "Patient", "Coordination"].map((value) => <option key={value} value={value}>{value === "Patient" ? "Personal" : value}</option>)}</select></Field>
      {drawer === "edit" && <Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DemoTaskStatus })}>{["Open", "In progress", "Completed"].map((value) => <option key={value}>{value}</option>)}</select></Field>}
      <Field label="Supporting note (optional)"><textarea maxLength={2000} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
      <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save task"}</Button>
      {drawer === "edit" && selected && <Button variant="danger" className="ml-2" disabled={busy} onClick={() => { if (window.confirm(`Delete "${selected.title}"? Its history will be retained.`)) void mutate(() => deleteTask(selected.id), "Task deleted"); }}>Delete task</Button>}
    </fieldset><Message error={feedback.error}>{feedback.message}</Message></form></Drawer>}
  </AppShell>;
}
