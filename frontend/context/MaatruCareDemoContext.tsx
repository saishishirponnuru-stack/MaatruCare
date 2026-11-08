"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  api,
  ApiError,
  type ApiCaregiver,
  type ApiConsentRecord,
  type ApiIdentity,
  type ApiHandoff,
  type ApiPermission,
  type ApiTask,
  type ApiTimelineEvent,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export type DemoOwner = string;

export type DemoCategory =
  | "Appointment"
  | "Transport"
  | "Patient"
  | "Coordination";

export type DemoTaskStatus = "Open" | "In progress" | "Completed";

export type DemoTask = {
  id: string;
  title: string;
  owner: DemoOwner;
  ownerKey: string;
  ownerDemo?: boolean;
  priority?: "Low" | "Normal" | "High";
  dueDate: string;
  category: DemoCategory;
  status: DemoTaskStatus;
  note: string;
  createdBy: string;
};

export type DemoHandoffStage =
  | "Prepared"
  | "Sent"
  | "Acknowledged"
  | "Completed"
  | "Needs review"
  | "Cancelled";

export type DemoHandoff = {
  archivedAt?: string | null;
  cancelledAt?: string | null;
  id: string;
  title: string;
  from: DemoOwner;
  to: DemoOwner;
  reason: string;
  stage: DemoHandoffStage;
  created: string;
  createdAt?: string;
  sentAt?: string | null;
  acknowledgedAt?: string | null;
  completedAt?: string | null;
  fromDemo?: boolean;
  toDemo?: boolean;
  fromId: number;
  toId: number;
  context?: string;
  relatedTaskId?: number;
  clarification?: string;
};

export type DemoTimelineEvent = {
  id: string;
  title: string;
  description: string;
  time: string;
  eventDate: string;
  eventType: string;
  source?: string;
  actor?: string;
  timestamp?: string;
  resourceType?: string;
  resourceId?: number;
  simulated?: boolean;
};

export type PermissionName =
  | "Appointments"
  | "Coordination tasks"
  | "Care handoffs"
  | "Approved care updates";

export type DemoPermissions = Record<string, Record<PermissionName, boolean>>;

export type MaatruCareDemoContextValue = {
  tasks: DemoTask[];
  handoffs: DemoHandoff[];
  timeline: DemoTimelineEvent[];
  permissions: DemoPermissions;
  consentHistory: ApiConsentRecord[];
  loading: boolean;
  error: string;
  timelineLoading: boolean;
  timelineError: string;
  taskError: string;
  handoffError: string;
  syncSavedTask: (task: ApiTask) => void;

  addTask: (
    task: Omit<DemoTask, "id" | "status" | "createdBy">
  ) => Promise<void>;

  updateTask: (
    id: string,
    patch: Partial<DemoTask>
  ) => Promise<void>;

  completeTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  reassignTask: (
    id: string,
    owner: DemoOwner
  ) => Promise<void>;

  createHandoff: (
    handoff: Omit<DemoHandoff, "id" | "stage" | "created" | "from" | "to">
  ) => Promise<string>;

  sendHandoff: (id: string) => Promise<void>;
  acknowledgeHandoff: (id: string) => Promise<void>;

  completeHandoff: (id: string) => Promise<void>;
  removeHandoff: (id: string) => Promise<void>;

  addTimelineEvent: (
    title: string,
    description: string
  ) => void;

  updateConsentPermission: (
    caregiver: number,
    permission: PermissionName,
    enabled: boolean
  ) => Promise<void>;
  caregiverRecords: ApiCaregiver[];
  refreshData: () => Promise<boolean>;
  removeCaregiver: (id: number) => Promise<void>;
};

const DemoContext =
  createContext<MaatruCareDemoContextValue | null>(null);

function caregiverName(
  id: number | null,
  caregivers: ApiCaregiver[]
): DemoOwner | undefined {
  const member = caregivers.find((caregiver) => caregiver.id === id);
  return member?.name;
}

function mapTask(
  task: ApiTask,
  caregivers: ApiCaregiver[],
  patientName: string,
): DemoTask {
  const ownerName = caregiverName(task.owner_id, caregivers);
  return {
    id: String(task.id),
    title: task.title,
    ownerKey: task.owner_id !== null ? `caregiver:${task.owner_id}` : `patient:${task.owner_patient_id}`,
    ownerDemo: task.owner_is_demo ?? caregivers.find((member) => member.id === task.owner_id)?.is_demo,
    priority: task.priority,
    owner: ownerName ?? task.owner_name ?? (task.owner_patient_id !== null ? patientName : task.owner_id !== null ? "Former caregiver" : "Unassigned"),
    dueDate: task.due_date,
    category: task.category as DemoCategory,
    status:
      task.status as DemoTaskStatus,
    note: task.note ?? "",
    createdBy: "MaatruCare",
  };
}

function mapHandoff(
  handoff: ApiHandoff,
  caregivers: ApiCaregiver[]
): DemoHandoff {
  const from =
    caregiverName(
      handoff.from_caregiver_id,
      caregivers
    ) ?? handoff.from_name;

  const to =
    caregiverName(
      handoff.to_caregiver_id,
      caregivers
    ) ?? handoff.to_name;

  const stage: DemoHandoffStage =
    handoff.status === "Completed"
      ? "Completed"
      : handoff.status === "Prepared"
        ? "Prepared"
        : handoff.status === "Acknowledged"
          ? "Acknowledged"
          : handoff.status ===
              "Awaiting acknowledgement"
            ? "Sent"
            : handoff.status === "Cancelled" ? "Cancelled" : "Needs review";

  return {
    id: String(handoff.id),
    title: handoff.title,
    from,
    to,
    archivedAt: handoff.archived_at,
    cancelledAt: handoff.cancelled_at,
    createdAt: handoff.created_at,
    sentAt: handoff.sent_at,
    acknowledgedAt: handoff.acknowledged_at,
    completedAt: handoff.completed_at,
    fromDemo: handoff.from_is_demo,
    toDemo: handoff.to_is_demo,
    fromId: handoff.from_caregiver_id,
    toId: handoff.to_caregiver_id,
    reason: handoff.reason,
    context: handoff.context ?? undefined,
    relatedTaskId: handoff.related_task_id ?? undefined,
    stage,
    created: new Date(
      handoff.created_at
    ).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
  };
}

// Preserve the actual API date and event type.
function mapTimelineEvent(
  event: ApiTimelineEvent
): DemoTimelineEvent {
  return {
    id: String(event.id),
    title: event.title,
    description:
      event.description ?? event.event_type,
    time: new Date(
      event.event_date
    ).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
    eventDate: String(event.event_date).slice(0, 10),
    eventType: event.event_type,
    source: event.source ?? undefined,
    actor: event.actor_name ?? undefined,
    timestamp: event.created_at,
    resourceType: event.resource_type ?? undefined,
    resourceId: event.resource_id ?? undefined,
    simulated: event.simulated,
  };
}

function mapPermissions(
  records: ApiPermission[],
  caregivers: ApiCaregiver[]
): DemoPermissions {
  const permissionCaregiverNames = new Map<number, DemoOwner>();
  for (const caregiver of caregivers) {
    permissionCaregiverNames.set(caregiver.id, String(caregiver.id));
  }

  const mapped: DemoPermissions = Object.fromEntries(
    caregivers.map((caregiver) => [String(caregiver.id), {
      Appointments: false,
      "Coordination tasks": false,
      "Care handoffs": false,
      "Approved care updates": false,
    }]),
  );

  records.forEach((record) => {
    const name = permissionCaregiverNames.get(record.caregiver_id);

    const permissionNames: readonly string[] = [
      "Appointments",
      "Coordination tasks",
      "Care handoffs",
      "Approved care updates",
    ];

    if (
      name &&
      permissionNames.includes(record.permission_name)
    ) {
      mapped[name][record.permission_name as PermissionName] =
        record.enabled;
    }
  });

  return mapped;
}

export function MaatruCareDemoProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { account } = useAuth();
  const identity = useMemo<ApiIdentity | null>(() => account?.patient_id && account.caregiver_id
    ? { patientId: account.patient_id, caregiverId: account.caregiver_id }
    : null, [account]);
  const patientName = account?.patient?.name ?? account?.name ?? "Care Circle owner";
  const [tasks, setTasks] = useState<DemoTask[]>([]);
  const [handoffs, setHandoffs] = useState<DemoHandoff[]>([]);
  const [timeline, setTimeline] = useState<DemoTimelineEvent[]>([]);

  const [consentHistory, setConsentHistory] = useState<ApiConsentRecord[]>([]);
  const [permissions, setPermissions] = useState<DemoPermissions>({});

  const [caregiverRecords, setCaregiverRecords] = useState<ApiCaregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [handoffError, setHandoffError] = useState("");
  const [dataIdentityKey, setDataIdentityKey] = useState<string | null>(null);
  const refreshGeneration = useRef(0);
  const handoffSaving = useRef(new Set<string>());
  const permissionSaving = useRef(false);
  const identityKey = identity ? `${identity.patientId}:${identity.caregiverId}` : null;

  const refresh = useCallback(async function refresh(): Promise<boolean> {
    const generation = ++refreshGeneration.current;
    setDataIdentityKey(identity ? `${identity.patientId}:${identity.caregiverId}` : null);
    setTasks([]);
    setHandoffs([]);
    setTimeline([]);
    setPermissions({});
    setConsentHistory([]);
    setCaregiverRecords([]);
    setError("");
    setTimelineError("");
    setTaskError("");
    setHandoffError("");
    setTimelineLoading(Boolean(identity));
    if (!identity) {
      setLoading(false);
      return false;
    }
    setLoading(true);

    const errors: string[] = [];

    try {
      const results = await Promise.allSettled([
        api.getCaregivers(identity),
        api.getTasks(identity),
        api.getHandoffs(identity),
        api.getTimeline(identity, 15, 0),
        api.getPermissions(identity),
        api.getConsentHistory(identity),
      ]);

      if (generation !== refreshGeneration.current) return false;

      let caregiversResult = results[0];
      const [
        ,
        tasksResult,
        handoffsResult,
        timelineResult,
        permissionsResult,
        historyResult,
      ] = results;

      if (caregiversResult.status === "rejected" && permissionsResult.status === "fulfilled") {
        const permittedScope = permissionsResult.value.find((item) => item.caregiver_id === identity.caregiverId && item.enabled && ["Care handoffs", "Appointments", "Approved care updates"].includes(item.permission_name))?.permission_name;
        if (permittedScope) {
          try { caregiversResult = { status: "fulfilled", value: await api.getCaregivers(identity, permittedScope) }; }
          catch (reason) { caregiversResult = { status: "rejected", reason }; }
          if (generation !== refreshGeneration.current) return false;
        }
      }
      if (caregiversResult.status === "rejected") {
        const denied = caregiversResult.reason instanceof ApiError && caregiversResult.reason.status === 403;
        throw new Error(
          denied
            ? "Coordination tasks are not shared with you. Ask the Care Circle owner to update sharing."
            : "Caregiver data could not be loaded."
        );
      }

      const caregivers = [...caregiversResult.value];
      if (account?.role === "patient" && !caregivers.some((record) => record.id === identity.caregiverId)) {
        caregivers.push({ id: identity.caregiverId, patient_id: identity.patientId, name: account.name, is_patient: true, is_demo: false, relationship: "Primary caregiver", role: "Patient", access_status: "Active", email: account.email, created_at: "" });
      }
      if (historyResult.status === "fulfilled") setConsentHistory(historyResult.value);
      setCaregiverRecords(caregivers.filter((record) => !record.is_patient && !(account?.role === "patient" && record.id === identity.caregiverId)));

      if (tasksResult.status === "fulfilled") {
        const uniqueTasks = new Map<string, DemoTask>();

        for (const task of tasksResult.value) {
          if (task.id === null || task.id === undefined || String(task.id).trim() === "") {
            console.warn("Skipping task with missing ID:", task);
            continue;
          }

          const mapped = mapTask(task, caregivers, patientName);

          if (uniqueTasks.has(mapped.id)) {
            console.warn("Duplicate task ID received:", mapped.id);
            continue;
          }

          uniqueTasks.set(mapped.id, mapped);
        }

        setTasks(Array.from(uniqueTasks.values()));
      } else {
        const denied = tasksResult.reason instanceof ApiError && tasksResult.reason.status === 403;
        setTaskError(denied ? "Tasks are not shared with this account." : "Tasks could not be loaded. Try again.");
      }

      if (handoffsResult.status === "fulfilled") {
        setHandoffs(
          handoffsResult.value.map((handoff) =>
            mapHandoff(handoff, caregivers)
          )
        );
      } else {
        setHandoffError(handoffsResult.reason instanceof ApiError && handoffsResult.reason.status === 403 ? "Handoffs are not shared with this account." : "Handoffs could not be loaded. Try again.");
      }

      if (timelineResult.status === "fulfilled") {
        setTimeline(
          timelineResult.value.map(mapTimelineEvent)
        );
        setTimelineError("");
      } else {
        setTimelineError("Timeline could not be loaded.");

      }

      if (permissionsResult.status === "fulfilled") {
        setPermissions(
          mapPermissions(
            permissionsResult.value,
            caregivers
          )
        );
      } else {
        errors.push(
          "Consent permissions could not be loaded."
        );
      }

      setError(errors.join(" "));
      return errors.length === 0;
    } catch (cause) {
      if (generation !== refreshGeneration.current) return false;
      setTasks([]);
      setHandoffs([]);
      setTimeline([]);
      setPermissions({});
    setConsentHistory([]);
      setCaregiverRecords([]);
      setTimelineError("Timeline could not be loaded.");
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load coordination data."
      );
      return false;
    } finally {
      if (generation === refreshGeneration.current) {
        setTimelineLoading(false);
        setLoading(false);
      }
    }
  }, [identity, patientName, account]);

  useEffect(() => {
    const handle = window.setTimeout(
      () => {
        void refresh();
      },
      0
    );

    return () => window.clearTimeout(handle);
  }, [refresh]);

  async function unsupportedMutation(
    message: string
  ): Promise<never> {
    setError(message);
    throw new Error(message);
  }

  function canActOnHandoffRecipient(handoff: DemoHandoff): boolean {
    if (!identity) return false;
    return handoff.toId === identity.caregiverId || Boolean(handoff.toDemo && account?.role === "patient");
  }

  function taskOwnerCreateFields(ownerKey: string): { owner_id?: number; owner_patient_id?: number } {
    const [kind, rawId] = ownerKey.split(":"); const id = Number(rawId);
    if (kind === "patient" && id === identity?.patientId) return { owner_patient_id: id };
    if (kind === "caregiver" && caregiverRecords.some((member) => member.id === id && member.access_status === "Active")) return { owner_id: id };
    throw new Error("Choose an active member of your Care Circle.");
  }
  function mergeTask(saved: ApiTask) {
    if (!identity || saved.patient_id !== identity.patientId) throw new Error("This task does not belong to your current workspace.");
    const mapped = mapTask(saved, caregiverRecords, patientName);
    setTasks((previous) => [mapped, ...previous.filter((item) => item.id !== mapped.id)]);
    void api.getTimeline(identity!, 15, 0).then((events) => setTimeline(events.map(mapTimelineEvent))).catch(() => setTimelineError("History could not be refreshed. Try again."));
  }
  async function addTask(task: Omit<DemoTask, "id" | "status" | "createdBy">) {
    mergeTask(await api.createTask({ patient_id: identity!.patientId, actor_caregiver_id: identity!.caregiverId, title: task.title, note: task.note, priority: task.priority, ...taskOwnerCreateFields(task.ownerKey), due_date: task.dueDate, category: task.category }));
  }
  async function updateTask(id: string, patch: Partial<DemoTask>) {
    const owner = patch.ownerKey ? taskOwnerCreateFields(patch.ownerKey) : undefined;
    mergeTask(await api.updateTask(Number(id), { title: patch.title, note: patch.note, priority: patch.priority, status: patch.status, due_date: patch.dueDate, category: patch.category, ...(owner ? { owner_id: owner.owner_id ?? null, owner_patient_id: owner.owner_patient_id ?? null } : {}), actor_caregiver_id: identity!.caregiverId }));
  }
  async function completeTask(id: string) {
    const task = tasks.find((item) => item.id === id); if (!task) throw new Error("Task not found.");
    mergeTask(await api.completeTask(Number(id), task.status !== "Completed", identity!));
  }
  async function deleteTask(id: string) {
    await api.deleteTask(Number(id), identity!);
    setTasks((previous) => previous.filter((item) => item.id !== id));
    void api.getTimeline(identity!, 15, 0).then((events) => setTimeline(events.map(mapTimelineEvent))).catch(() => setTimelineError("History could not be refreshed."));
  }

  async function removeCaregiver(id: number) {
    await api.removeCaregiver(id, identity!);
    await refresh();
  }

  async function reassignTask(id: string, ownerKey: string) { await updateTask(id, { ownerKey }); }
  async function createHandoff(
    handoff: Omit<DemoHandoff, "id" | "stage" | "created" | "from" | "to">
  ) {
    const created = await api.createHandoff({
      patient_id: identity!.patientId,
      title: handoff.title,
      from_caregiver_id: handoff.fromId,
      to_caregiver_id: handoff.toId,
      reason: handoff.reason,
      context: handoff.context,
      related_task_id: handoff.relatedTaskId,
      actor_caregiver_id: identity!.caregiverId,
    });

    const newHandoff = mapHandoff(created, [...caregiverRecords, ...(account?.caregiver_id ? [{ id: account.caregiver_id, name: account.name } as ApiCaregiver] : [])]);

    setHandoffs((previous) => [
      newHandoff,
      ...previous.filter((item) => item.id !== newHandoff.id),
    ]);

    void api.getTimeline(identity!, 15, 0)
      .then((events) => setTimeline(events.map(mapTimelineEvent)))
      .catch(() => setTimelineError("History could not be refreshed. Try again."));

    return String(created.id);
  }
  async function transitionHandoff(id: string, action: (id: number, identity: ApiIdentity) => Promise<ApiHandoff>) {
    if (!identity) throw new Error("Your care account is not linked.");
    if (handoffSaving.current.has(id)) return;
    handoffSaving.current.add(id);
    try {
      const saved = await action(Number(id), identity);
      const members = [...caregiverRecords, ...(account?.role === "patient" ? [{ id: identity.caregiverId, name: account.name } as ApiCaregiver] : [])];
      setHandoffs((previous) => previous.map((item) => item.id === id ? mapHandoff(saved, members) : item));
      void api.getTimeline(identity, 15, 0).then((events) => setTimeline(events.map(mapTimelineEvent))).catch(() => setTimelineError("History could not be refreshed. Try again."));
    } finally { handoffSaving.current.delete(id); }
  }
  async function sendHandoff(id: string) { await transitionHandoff(id, api.sendHandoff); }
  async function acknowledgeHandoff(id: string) {
    const handoff = handoffs.find((item) => item.id === id);
    if (!handoff || !canActOnHandoffRecipient(handoff)) throw new Error("Only the receiving caregiver can acknowledge a real handoff.");
    await transitionHandoff(id, api.acknowledgeHandoff);
  }
  async function completeHandoff(id: string) {
    const handoff = handoffs.find((item) => item.id === id);
    if (!handoff || !canActOnHandoffRecipient(handoff)) throw new Error("Only the receiving caregiver can complete a real handoff.");
    await transitionHandoff(id, api.completeHandoff);
  }
  async function removeHandoff(id: string) {
    const handoff = handoffs.find((item) => item.id === id);
    if (!handoff) throw new Error("Handoff not found.");
    const expected = handoff.stage === "Sent" ? "Awaiting acknowledgement" : handoff.stage;
    await transitionHandoff(id, (key, who) => api.removeHandoff(key, who, expected));
  }
  async function updateConsentPermission(
    caregiver: number,
    permission: PermissionName,
    enabled: boolean
  ) {
    const caregiverRecord = caregiverRecords.find((record) => record.id === caregiver);
    if (!caregiverRecord || caregiverRecord.is_patient || caregiver === identity?.caregiverId) {
      throw new Error(
        "Your own workspace access cannot be changed through caregiver sharing."
      );
    }

    if (permissionSaving.current) return;
    permissionSaving.current = true;
    const previousEnabled = permissions[caregiver]?.[permission] ?? false;

    setError("");

    setPermissions((previous) => ({
      ...previous,
      [caregiver]: {
        ...(previous[caregiver] ?? {
          Appointments: false,
          "Coordination tasks": false,
          "Care handoffs": false,
          "Approved care updates": false,
        }),
        [permission]: enabled,
      },
    }));

    try {
      await api.updatePermission({
        patient_id: identity!.patientId,
        caregiver_id: caregiver,
        permission_name: permission,
        enabled,
        actor_caregiver_id:
          identity!.caregiverId,
      });
      void api.getConsentHistory(identity!).then(setConsentHistory).catch(() => {});

      void api.getTimeline(identity!, 15, 0)
        .then((events) => setTimeline(events.map(mapTimelineEvent)))
        .catch((error) => {
          console.warn("Timeline refresh failed:", error);
        });
    } catch (error) {
      setPermissions((previous) => ({
        ...previous,
        [caregiver]: {
          ...(previous[caregiver] ?? {
            Appointments: false,
            "Coordination tasks": false,
            "Care handoffs": false,
            "Approved care updates": false,
          }),
          [permission]: previousEnabled,
        },
      }));

      const message =
        error instanceof Error
          ? error.message
          : "Unable to update permission.";

      setError(message);
      throw error;
    } finally { permissionSaving.current = false; }
  }
  const value: MaatruCareDemoContextValue = {
      tasks: identityKey === dataIdentityKey ? tasks : [],
      handoffs: identityKey === dataIdentityKey ? handoffs : [],
      timeline: identityKey === dataIdentityKey ? timeline : [],
      permissions: identityKey === dataIdentityKey ? { ...permissions, ...(account?.role === "patient" && identity ? { [identity.caregiverId]: { Appointments: true, "Coordination tasks": true, "Care handoffs": true, "Approved care updates": true } } : {}) } : {},
      consentHistory: identityKey === dataIdentityKey ? consentHistory : [],
      loading,
      error,
      timelineLoading,
      timelineError,
      taskError,
      handoffError,
      addTask,
      syncSavedTask: mergeTask,
      updateTask,
      completeTask,
      deleteTask,
      reassignTask,
      createHandoff,
      sendHandoff,
      acknowledgeHandoff,
      completeHandoff,
      removeHandoff,
      addTimelineEvent: () =>
        unsupportedMutation(
          "Timeline events are recorded by backend mutations."
        ),
      updateConsentPermission,
      caregiverRecords: identityKey === dataIdentityKey ? caregiverRecords : [],
      refreshData: refresh,
      removeCaregiver,
  };
  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
}

export function useMaatruCareDemo() {
  const context = useContext(DemoContext);

  if (!context) {
    throw new Error(
      "useMaatruCareDemo must be used inside MaatruCareDemoProvider"
    );
  }

  return context;
}
