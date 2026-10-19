"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, DEMO_ACTOR_CAREGIVER_ID, DEMO_PATIENT_ID, type ApiCaregiver, type ApiHandoff, type ApiPermission, type ApiTask, type ApiTimelineEvent } from "@/lib/api";

export type DemoOwner = "Ananya Rao" | "Rahul Rao" | "Lakshmi Rao" | "Priya Rao";
export type DemoCategory = "Appointment" | "Transport" | "Patient" | "Coordination";
export type DemoTaskStatus = "Open" | "Completed";
export type DemoTask = { id: string; title: string; owner: DemoOwner; dueDate: string; category: DemoCategory; status: DemoTaskStatus; note: string; createdBy: string };
export type DemoHandoffStage = "Prepared" | "Sent" | "Reviewed" | "Acknowledged" | "Completed" | "Needs review";
export type DemoHandoff = { id: string; title: string; from: DemoOwner; to: DemoOwner; reason: string; task: string; contexts: string[]; stage: DemoHandoffStage; created: string; clarification?: string };
export type DemoTimelineEvent = { id: string; title: string; description: string; time: string };
export type PermissionName = "Appointments" | "Coordination tasks" | "Care handoffs" | "Approved care updates";
export type DemoPermissions = Record<DemoOwner, Record<PermissionName, boolean>>;

const owners: DemoOwner[] = ["Ananya Rao", "Rahul Rao", "Lakshmi Rao", "Priya Rao"];

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
  loading: boolean;
  error: string;
  addTask: (task: Omit<DemoTask, "id" | "status" | "createdBy">) => Promise<void>;
  updateTask: (id: string, patch: Partial<DemoTask>) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  reassignTask: (id: string, owner: DemoOwner) => Promise<void>;
  createHandoff: (handoff: Omit<DemoHandoff, "id" | "stage" | "created">) => Promise<string>;
  sendHandoff: (id: string) => Promise<void>;
  acknowledgeHandoff: (id: string) => Promise<void>;
  requestHandoffChanges: (id: string, clarification: string) => Promise<void>;
  completeHandoff: (id: string) => Promise<void>;
  addTimelineEvent: (title: string, description: string) => void;
  updateConsentPermission: (caregiver: DemoOwner, permission: PermissionName, enabled: boolean) => Promise<void>;
};

const DemoContext = createContext<MaatruCareDemoContextValue | null>(null);

export function MaatruCareDemoProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<DemoTask[]>([]);
  const [handoffs, setHandoffs] = useState<DemoHandoff[]>([]);
  const [timeline, setTimeline] = useState<DemoTimelineEvent[]>([]);
  const [permissions, setPermissions] = useState<DemoPermissions>({
    "Ananya Rao": { Appointments: false, "Coordination tasks": false, "Care handoffs": false, "Approved care updates": false },
    "Rahul Rao": { Appointments: false, "Coordination tasks": false, "Care handoffs": false, "Approved care updates": false },
    "Lakshmi Rao": { Appointments: false, "Coordination tasks": false, "Care handoffs": false, "Approved care updates": false },
    "Priya Rao": { Appointments: false, "Coordination tasks": false, "Care handoffs": false, "Approved care updates": false },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function caregiverName(id: number | null, caregivers: ApiCaregiver[]) {
    return caregivers.find((caregiver) => caregiver.id === id)?.name as DemoOwner | undefined;
  }

  function mapTask(task: ApiTask, caregivers: ApiCaregiver[]): DemoTask {
    return {
      id: String(task.id),
      title: task.title,
      owner: caregiverName(task.owner_id, caregivers) ?? "Ananya Rao",
      dueDate: task.due_date,
      category: task.category as DemoCategory,
      status: task.status === "Completed" ? "Completed" : "Open",
      note: "Persisted coordination task.",
      createdBy: "MaatruCare",
    };
  }

  function mapHandoff(handoff: ApiHandoff, caregivers: ApiCaregiver[]): DemoHandoff {
    const from = caregiverName(handoff.from_caregiver_id, caregivers) ?? "Ananya Rao";
    const to = caregiverName(handoff.to_caregiver_id, caregivers) ?? "Ananya Rao";
    const stage: DemoHandoffStage = handoff.status === "Prepared" ? "Prepared" : handoff.status === "Acknowledged" ? "Acknowledged" : "Sent";
    return {
      id: String(handoff.id),
      title: handoff.title,
      from,
      to,
      reason: handoff.reason,
      task: "Coordination responsibility",
      contexts: [],
      stage,
      created: new Date(handoff.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    };
  }

  function mapTimelineEvent(event: ApiTimelineEvent): DemoTimelineEvent {
    return {
      id: String(event.id),
      title: event.title,
      description: event.description ?? event.event_type,
      time: new Date(event.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    };
  }

  function mapPermissions(records: ApiPermission[], caregivers: ApiCaregiver[]): DemoPermissions {
    const mapped: DemoPermissions = {
      "Ananya Rao": { Appointments: false, "Coordination tasks": false, "Care handoffs": false, "Approved care updates": false },
      "Rahul Rao": { Appointments: false, "Coordination tasks": false, "Care handoffs": false, "Approved care updates": false },
      "Lakshmi Rao": { Appointments: false, "Coordination tasks": false, "Care handoffs": false, "Approved care updates": false },
      "Priya Rao": { Appointments: false, "Coordination tasks": false, "Care handoffs": false, "Approved care updates": false },
    };
    records.forEach((record) => {
      const name = caregiverName(record.caregiver_id, caregivers);
      if (name && owners.includes(name)) mapped[name][record.permission_name as PermissionName] = record.enabled;
    });
    return mapped;
  }

  async function refresh() {
    setLoading(true);
    try {
      const [caregivers, apiTasks, apiHandoffs, apiTimeline, apiPermissions] = await Promise.all([
        api.getCaregivers(),
        api.getTasks(),
        api.getHandoffs(),
        api.getTimeline(),
        api.getPermissions(),
      ]);
      setTasks(apiTasks.map((task) => mapTask(task, caregivers)));
      setHandoffs(apiHandoffs.map((handoff) => mapHandoff(handoff, caregivers)));
      setTimeline(apiTimeline.map(mapTimelineEvent));
      setPermissions(mapPermissions(apiPermissions, caregivers));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load coordination data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  async function unsupportedMutation(message: string): Promise<never> {
    setError(message);
    throw new Error(message);
  }
  const caregiverIds: Record<DemoOwner, number> = { "Ananya Rao": DEMO_ACTOR_CAREGIVER_ID, "Rahul Rao": 1, "Lakshmi Rao": 2, "Priya Rao": 3 };
  async function addTask(task: Omit<DemoTask, "id" | "status" | "createdBy">) {
    await api.createTask({ patient_id: DEMO_PATIENT_ID, title: task.title, owner_id: caregiverIds[task.owner], due_date: task.dueDate, category: task.category, actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID });
    await refresh();
  }
  async function updateTask(id: string, patch: Partial<DemoTask>) {
    await api.updateTask(Number(id), { title: patch.title, owner_id: patch.owner ? caregiverIds[patch.owner] : undefined, due_date: patch.dueDate, category: patch.category, actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID });
    await refresh();
  }
  async function completeTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) throw new Error("Task not found.");
    await api.completeTask(Number(id), task.status !== "Completed");
    await refresh();
  }
  async function reassignTask(id: string, owner: DemoOwner) {
    await api.updateTask(Number(id), { owner_id: caregiverIds[owner], actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID });
    await refresh();
  }
  async function createHandoff(handoff: Omit<DemoHandoff, "id" | "stage" | "created">) {
    const caregiverIds: Record<DemoOwner, number> = { "Ananya Rao": DEMO_ACTOR_CAREGIVER_ID, "Rahul Rao": 1, "Lakshmi Rao": 2, "Priya Rao": 3 };
    const created = await api.createHandoff({ patient_id: DEMO_PATIENT_ID, title: handoff.title, from_caregiver_id: caregiverIds[handoff.from], to_caregiver_id: caregiverIds[handoff.to], reason: handoff.reason, actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID });
    await refresh();
    return String(created.id);
  }
  async function sendHandoff(id: string) { await api.sendHandoff(Number(id)); await refresh(); }
  async function acknowledgeHandoff(id: string) {
    const handoff = handoffs.find((item) => item.id === id);
    const caregiverIds: Record<DemoOwner, number> = { "Ananya Rao": DEMO_ACTOR_CAREGIVER_ID, "Rahul Rao": 1, "Lakshmi Rao": 2, "Priya Rao": 3 };
    if (!handoff) throw new Error("Handoff not found.");
    await api.acknowledgeHandoff(Number(id), caregiverIds[handoff.to]);
    await refresh();
  }
  async function updateConsentPermission(
  caregiver: DemoOwner,
  permission: PermissionName,
  enabled: boolean
) {
  const caregiverIds: Record<DemoOwner, number> = {
    "Ananya Rao": DEMO_ACTOR_CAREGIVER_ID,
    "Rahul Rao": 1,
    "Lakshmi Rao": 2,
    "Priya Rao": 3,
  };

  setError("");

  try {
    await api.updatePermission({
      patient_id: DEMO_PATIENT_ID,
      caregiver_id: caregiverIds[caregiver],
      permission_name: permission,
      enabled,
      actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID,
    });

    await refresh();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update permission.";

    setError(message);
    throw error;
  }
}

  const value = useMemo(() => ({
    tasks,
    handoffs,
    timeline,
    permissions,
    loading,
    error,
    addTask,
    updateTask,
    completeTask,
    reassignTask,
    createHandoff,
    sendHandoff,
    acknowledgeHandoff,
    requestHandoffChanges: () => unsupportedMutation("Handoff review requests are not supported by the backend yet."),
    completeHandoff: () => unsupportedMutation("Handoff completion is not supported by the backend yet."),
    addTimelineEvent: () => unsupportedMutation("Timeline events are recorded by backend mutations."),
    updateConsentPermission,
  }), [tasks, handoffs, timeline, permissions, loading, error]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useMaatruCareDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useMaatruCareDemo must be used inside MaatruCareDemoProvider");
  return context;
}

export { initialHandoff };
