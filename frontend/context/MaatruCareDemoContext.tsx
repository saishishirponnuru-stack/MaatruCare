"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type DemoOwner = "Ananya Rao" | "Rahul Rao" | "Lakshmi Rao" | "Priya Rao";
export type DemoCategory = "Appointment" | "Transport" | "Patient" | "Coordination";
export type DemoTaskStatus = "Open" | "Completed";
export type DemoTask = { id: string; title: string; owner: DemoOwner; dueDate: string; category: DemoCategory; status: DemoTaskStatus; note: string; createdBy: string };
export type DemoHandoffStage = "Prepared" | "Sent" | "Reviewed" | "Acknowledged" | "Completed" | "Needs review";
export type DemoHandoff = { id: string; title: string; from: DemoOwner; to: DemoOwner; reason: string; task: string; contexts: string[]; stage: DemoHandoffStage; created: string; clarification?: string };
export type DemoTimelineEvent = { id: string; title: string; description: string; time: string };
export type PermissionName = "Appointments" | "Coordination tasks" | "Care handoffs" | "Approved care updates";
export type DemoPermissions = Record<DemoOwner, Record<PermissionName, boolean>>;

const initialTasks: DemoTask[] = [
  { id: "task-1", title: "Prepare appointment documents", owner: "Rahul Rao", dueDate: "2026-09-28", category: "Appointment", status: "Open", note: "Keep approved documents ready for the upcoming visit.", createdBy: "Ananya Rao" },
  { id: "task-2", title: "Confirm transport", owner: "Lakshmi Rao", dueDate: "2026-09-28", category: "Transport", status: "Open", note: "Confirm transport for the 28 September appointment.", createdBy: "Ananya Rao" },
  { id: "task-3", title: "Review appointment details", owner: "Ananya Rao", dueDate: "2026-09-27", category: "Patient", status: "Open", note: "Check time, location and shared appointment information.", createdBy: "Ananya Rao" },
  { id: "task-4", title: "Confirm caregiver availability", owner: "Priya Rao", dueDate: "2026-09-30", category: "Coordination", status: "Open", note: "Confirm who can support around the scheduled visit.", createdBy: "Ananya Rao" },
];

const initialHandoffs: DemoHandoff[] = [{ id: "handoff-1", title: "Appointment coordination", from: "Rahul Rao", to: "Lakshmi Rao", reason: "Transport and appointment coordination responsibility", task: "Confirm transport; Prepare appointment documents", contexts: ["Appointment details", "Coordination task details"], stage: "Sent", created: "26 Sep" }];

const initialTimeline: DemoTimelineEvent[] = [
  { id: "activity-1", title: "Appointment coordination updated", description: "Upcoming visit details are confirmed.", time: "18 min ago" },
  { id: "activity-2", title: "Transport responsibility assigned", description: "Lakshmi is coordinating transport.", time: "42 min ago" },
  { id: "activity-3", title: "Care handoff acknowledged", description: "Appointment coordination is with Lakshmi.", time: "1 hr ago" },
  { id: "activity-4", title: "Consent permission updated", description: "Rahul can view approved care updates.", time: "Yesterday" },
];

const initialPermissions: DemoPermissions = {
  "Ananya Rao": { Appointments: true, "Coordination tasks": true, "Care handoffs": true, "Approved care updates": true },
  "Rahul Rao": { Appointments: true, "Coordination tasks": true, "Care handoffs": true, "Approved care updates": true },
  "Lakshmi Rao": { Appointments: true, "Coordination tasks": true, "Care handoffs": false, "Approved care updates": true },
  "Priya Rao": { Appointments: false, "Coordination tasks": true, "Care handoffs": false, "Approved care updates": true },
};

const initialHandoff: DemoHandoff = initialHandoffs[0];

export type MaatruCareDemoContextValue = {
  tasks: DemoTask[];
  handoffs: DemoHandoff[];
  timeline: DemoTimelineEvent[];
  permissions: DemoPermissions;
  addTask: (task: Omit<DemoTask, "id" | "status" | "createdBy">) => void;
  updateTask: (id: string, patch: Partial<DemoTask>) => void;
  completeTask: (id: string) => void;
  reassignTask: (id: string, owner: DemoOwner) => void;
  createHandoff: (handoff: Omit<DemoHandoff, "id" | "stage" | "created">) => string;
  sendHandoff: (id: string) => void;
  acknowledgeHandoff: (id: string) => void;
  requestHandoffChanges: (id: string, clarification: string) => void;
  completeHandoff: (id: string) => void;
  addTimelineEvent: (title: string, description: string) => void;
  updateConsentPermission: (caregiver: DemoOwner, permission: PermissionName, enabled: boolean) => void;
};

const DemoContext = createContext<MaatruCareDemoContextValue | null>(null);

export function MaatruCareDemoProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [handoffs, setHandoffs] = useState(initialHandoffs);
  const [timeline, setTimeline] = useState(initialTimeline);
  const [permissions, setPermissions] = useState(initialPermissions);

  function addTimelineEvent(title: string, description: string) {
    setTimeline((current) => [{ id: `activity-${Date.now()}`, title, description, time: "Just now" }, ...current]);
  }
  function addTask(task: Omit<DemoTask, "id" | "status" | "createdBy">) {
    setTasks((current) => [...current, { ...task, id: `task-${Date.now()}`, status: "Open", createdBy: "Ananya Rao" }]);
    addTimelineEvent("Coordination task created", `${task.title} assigned to ${task.owner}.`);
  }
  function updateTask(id: string, patch: Partial<DemoTask>) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, ...patch } : task));
    const task = tasks.find((item) => item.id === id);
    if (task && patch.title) addTimelineEvent("Coordination task updated", patch.title);
  }
  function completeTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const status = task.status === "Completed" ? "Open" : "Completed";
    setTasks((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    addTimelineEvent(status === "Completed" ? "Coordination task completed" : "Coordination task reopened", task.title);
  }
  function reassignTask(id: string, owner: DemoOwner) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setTasks((current) => current.map((item) => item.id === id ? { ...item, owner } : item));
    addTimelineEvent("Coordination task reassigned", `${task.title} is now assigned to ${owner}.`);
  }
  function createHandoff(handoff: Omit<DemoHandoff, "id" | "stage" | "created">) {
    const id = `handoff-${Date.now()}`;
    setHandoffs((current) => [{ ...handoff, id, stage: "Prepared", created: "Today" }, ...current]);
    addTimelineEvent("Care handoff prepared", `${handoff.title} prepared for ${handoff.to}.`);
    return id;
  }
  function updateHandoff(id: string, stage: DemoHandoffStage, title: string, description: string) {
    setHandoffs((current) => current.map((handoff) => handoff.id === id ? { ...handoff, stage } : handoff));
    addTimelineEvent(title, description);
  }
  function sendHandoff(id: string) { const handoff = handoffs.find((item) => item.id === id); if (handoff) updateHandoff(id, "Sent", "Care handoff sent", `${handoff.title} sent to ${handoff.to}.`); }
  function acknowledgeHandoff(id: string) { const handoff = handoffs.find((item) => item.id === id); if (handoff) updateHandoff(id, "Acknowledged", "Care handoff acknowledged", `Responsibility is now with ${handoff.to}.`); }
  function requestHandoffChanges(id: string, clarification: string) { updateHandoff(id, "Needs review", "Handoff clarification requested", clarification); }
  function completeHandoff(id: string) { const handoff = handoffs.find((item) => item.id === id); if (handoff) updateHandoff(id, "Completed", "Care handoff completed", handoff.title); }
  function updateConsentPermission(caregiver: DemoOwner, permission: PermissionName, enabled: boolean) {
    setPermissions((current) => ({ ...current, [caregiver]: { ...current[caregiver], [permission]: enabled } }));
    addTimelineEvent("Consent permission updated", `${caregiver} ${enabled ? "can now view" : "can no longer view"} ${permission.toLowerCase()}.`);
  }

  const value = useMemo(() => ({ tasks, handoffs, timeline, permissions, addTask, updateTask, completeTask, reassignTask, createHandoff, sendHandoff, acknowledgeHandoff, requestHandoffChanges, completeHandoff, addTimelineEvent, updateConsentPermission }), [tasks, handoffs, timeline, permissions]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useMaatruCareDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useMaatruCareDemo must be used inside MaatruCareDemoProvider");
  return context;
}

export { initialHandoff };
