"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  api,
  DEMO_ACTOR_CAREGIVER_ID,
  DEMO_PATIENT_ID,
  type ApiCaregiver,
  type ApiHandoff,
  type ApiPermission,
  type ApiTask,
  type ApiTimelineEvent,
} from "@/lib/api";

export type DemoOwner =
  | "Ananya Rao"
  | "Rahul Rao"
  | "Lakshmi Rao"
  | "Priya Rao";

export type DemoCategory =
  | "Appointment"
  | "Transport"
  | "Patient"
  | "Coordination";

export type DemoTaskStatus = "Open" | "Completed";

export type DemoTask = {
  id: string;
  title: string;
  owner: DemoOwner;
  dueDate: string;
  category: DemoCategory;
  status: DemoTaskStatus;
  note: string;
  createdBy: string;
};

export type DemoHandoffStage =
  | "Prepared"
  | "Sent"
  | "Reviewed"
  | "Acknowledged"
  | "Completed"
  | "Needs review";

export type DemoHandoff = {
  id: string;
  title: string;
  from: DemoOwner;
  to: DemoOwner;
  reason: string;
  task: string;
  contexts: string[];
  stage: DemoHandoffStage;
  created: string;
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
};

export type PermissionName =
  | "Appointments"
  | "Coordination tasks"
  | "Care handoffs"
  | "Approved care updates";

export type DemoPermissions = Record<
  DemoOwner,
  Record<PermissionName, boolean>
>;

const owners: DemoOwner[] = [
  "Ananya Rao",
  "Rahul Rao",
  "Lakshmi Rao",
  "Priya Rao",
];

const initialHandoffs: DemoHandoff[] = [
  {
    id: "handoff-1",
    title: "Appointment coordination",
    from: "Rahul Rao",
    to: "Lakshmi Rao",
    reason: "Transport and appointment coordination responsibility",
    task: "Confirm transport; Prepare appointment documents",
    contexts: ["Appointment details", "Coordination task details"],
    stage: "Sent",
    created: "26 Sep",
  },
];

const initialHandoff: DemoHandoff = initialHandoffs[0];

export type MaatruCareDemoContextValue = {
  tasks: DemoTask[];
  handoffs: DemoHandoff[];
  timeline: DemoTimelineEvent[];
  permissions: DemoPermissions;
  loading: boolean;
  error: string;

  addTask: (
    task: Omit<DemoTask, "id" | "status" | "createdBy">
  ) => Promise<void>;

  updateTask: (
    id: string,
    patch: Partial<DemoTask>
  ) => Promise<void>;

  completeTask: (id: string) => Promise<void>;

  reassignTask: (
    id: string,
    owner: DemoOwner
  ) => Promise<void>;

  createHandoff: (
    handoff: Omit<DemoHandoff, "id" | "stage" | "created">
  ) => Promise<string>;

  sendHandoff: (id: string) => Promise<void>;
  acknowledgeHandoff: (id: string) => Promise<void>;

  requestHandoffChanges: (
    id: string,
    clarification: string
  ) => Promise<void>;

  completeHandoff: (id: string) => Promise<void>;

  addTimelineEvent: (
    title: string,
    description: string
  ) => void;

  updateConsentPermission: (
    caregiver: DemoOwner,
    permission: PermissionName,
    enabled: boolean
  ) => Promise<void>;
};

const DemoContext =
  createContext<MaatruCareDemoContextValue | null>(null);

function caregiverName(
  id: number | null,
  caregivers: ApiCaregiver[]
): DemoOwner | undefined {
  return caregivers.find(
    (caregiver) => caregiver.id === id
  )?.name as DemoOwner | undefined;
}

function mapTask(
  task: ApiTask,
  caregivers: ApiCaregiver[]
): DemoTask {
  return {
    id: String(task.id),
    title: task.title,
    owner:
      caregiverName(task.owner_id, caregivers) ??
      "Ananya Rao",
    dueDate: task.due_date,
    category: task.category as DemoCategory,
    status:
      task.status === "Completed" ? "Completed" : "Open",
    note: "Persisted coordination task.",
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
    ) ?? "Ananya Rao";

  const to =
    caregiverName(
      handoff.to_caregiver_id,
      caregivers
    ) ?? "Ananya Rao";

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
            : "Sent";

  return {
    id: String(handoff.id),
    title: handoff.title,
    from,
    to,
    reason: handoff.reason,
    task: "Coordination responsibility",
    contexts: [],
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
  };
}

function mapPermissions(
  records: ApiPermission[],
  caregivers: ApiCaregiver[]
): DemoPermissions {
  const mapped: DemoPermissions = {
    "Ananya Rao": {
      Appointments: false,
      "Coordination tasks": false,
      "Care handoffs": false,
      "Approved care updates": false,
    },
    "Rahul Rao": {
      Appointments: false,
      "Coordination tasks": false,
      "Care handoffs": false,
      "Approved care updates": false,
    },
    "Lakshmi Rao": {
      Appointments: false,
      "Coordination tasks": false,
      "Care handoffs": false,
      "Approved care updates": false,
    },
    "Priya Rao": {
      Appointments: false,
      "Coordination tasks": false,
      "Care handoffs": false,
      "Approved care updates": false,
    },
  };

  records.forEach((record) => {
    const permissionCaregiverNames: Record<number, DemoOwner> = {
      1: "Rahul Rao",
      2: "Lakshmi Rao",
      3: "Priya Rao",
    };

    const name = permissionCaregiverNames[record.caregiver_id];

    const permissionNames: readonly string[] = [
      "Appointments",
      "Coordination tasks",
      "Care handoffs",
      "Approved care updates",
    ];

    if (
      name &&
      owners.includes(name) &&
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
  const [tasks, setTasks] = useState<DemoTask[]>([]);
  const [handoffs, setHandoffs] = useState<DemoHandoff[]>([]);
  const [timeline, setTimeline] = useState<DemoTimelineEvent[]>([]);

  const [permissions, setPermissions] =
    useState<DemoPermissions>({
      "Ananya Rao": {
        Appointments: false,
        "Coordination tasks": false,
        "Care handoffs": false,
        "Approved care updates": false,
      },
      "Rahul Rao": {
        Appointments: false,
        "Coordination tasks": false,
        "Care handoffs": false,
        "Approved care updates": false,
      },
      "Lakshmi Rao": {
        Appointments: false,
        "Coordination tasks": false,
        "Care handoffs": false,
        "Approved care updates": false,
      },
      "Priya Rao": {
        Appointments: false,
        "Coordination tasks": false,
        "Care handoffs": false,
        "Approved care updates": false,
      },
    });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async function refresh(): Promise<boolean> {
    setLoading(true);

    const errors: string[] = [];

    try {
      const results = await Promise.allSettled([
        api.getCaregivers(),
        api.getTasks(),
        api.getHandoffs(),
        api.getTimeline(),
        api.getPermissions(),
      ]);

      const [
        caregiversResult,
        tasksResult,
        handoffsResult,
        timelineResult,
        permissionsResult,
      ] = results;

      if (caregiversResult.status === "rejected") {
        throw new Error("Caregiver data could not be loaded.");
      }

      const caregivers = caregiversResult.value;

      if (tasksResult.status === "fulfilled") {
        const uniqueTasks = new Map<string, DemoTask>();

        for (const task of tasksResult.value) {
          if (task.id === null || task.id === undefined || String(task.id).trim() === "") {
            console.warn("Skipping task with missing ID:", task);
            continue;
          }

          const mapped = mapTask(task, caregivers);

          if (uniqueTasks.has(mapped.id)) {
            console.warn("Duplicate task ID received:", mapped.id);
            continue;
          }

          uniqueTasks.set(mapped.id, mapped);
        }

        setTasks(Array.from(uniqueTasks.values()));
      } else {
        errors.push("Tasks could not be loaded.");
      }

      if (handoffsResult.status === "fulfilled") {
        setHandoffs(
          handoffsResult.value.map((handoff) =>
            mapHandoff(handoff, caregivers)
          )
        );
      } else {
        errors.push(
          "Care handoffs could not be loaded."
        );
      }

      if (timelineResult.status === "fulfilled") {
        setTimeline(
          timelineResult.value.map(mapTimelineEvent)
        );
      } else {
        errors.push(
          "Timeline access is unavailable."
        );
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
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load coordination data."
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

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

  const caregiverIds: Record<DemoOwner, number> = {
    "Ananya Rao": DEMO_ACTOR_CAREGIVER_ID,
    "Rahul Rao": 1,
    "Lakshmi Rao": 2,
    "Priya Rao": 3,
  };

  async function addTask(
    task: Omit<DemoTask, "id" | "status" | "createdBy">
  ) {
    const created = await api.createTask({
      patient_id: DEMO_PATIENT_ID,
      title: task.title,
      owner_id: caregiverIds[task.owner],
      due_date: task.dueDate,
      category: task.category,
      actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID,
    });

    const newTask: DemoTask = {
      ...task,
      id: String(created.id),
      status: created.status === "Completed" ? "Completed" : "Open",
      createdBy: "MaatruCare",
    };

    setTasks((previous) => [
      newTask,
      ...previous.filter((item) => item.id !== newTask.id),
    ]);

    void api.getTimeline()
      .then((events) => {
        setTimeline(events.map(mapTimelineEvent));
      })
      .catch((error) => {
        console.warn("Timeline refresh failed:", error);
      });
  }
  async function updateTask(
    id: string,
    patch: Partial<DemoTask>
  ) {
    const task = tasks.find((item) => item.id === id);

    if (!task) {
      throw new Error("Task not found.");
    }

    const previousTask = { ...task };

    setTasks((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    );

    try {
      await api.updateTask(Number(id), {
        title: patch.title,
        owner_id:
          patch.owner && patch.owner !== task.owner
            ? caregiverIds[patch.owner]
            : undefined,
        due_date: patch.dueDate,
        category: patch.category,
        actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID,
      });

      void api.getTimeline()
        .then((events) => setTimeline(events.map(mapTimelineEvent)))
        .catch((error) => {
          console.warn("Timeline refresh failed:", error);
        });
    } catch (error) {
      setTasks((previous) =>
        previous.map((item) =>
          item.id === id ? previousTask : item
        )
      );

      throw error;
    }
  }
  async function completeTask(id: string) {
    const task = tasks.find((item) => item.id === id);

    if (!task) {
      throw new Error("Task not found.");
    }

    const completed = task.status !== "Completed";
    const previousStatus = task.status;

    setTasks((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, status: completed ? "Completed" : "Open" }
          : item
      )
    );

    try {
      await api.completeTask(Number(id), completed);

      void api.getTimeline()
        .then((events) => setTimeline(events.map(mapTimelineEvent)))
        .catch((error) => {
          console.warn("Timeline refresh failed:", error);
        });
    } catch (error) {
      setTasks((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, status: previousStatus }
            : item
        )
      );

      throw error;
    }
  }

  async function reassignTask(
    id: string,
    owner: DemoOwner
  ) {
    const task = tasks.find((item) => item.id === id);

    if (!task) {
      throw new Error("Task not found.");
    }

    const previousOwner = task.owner;

    setTasks((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, owner } : item
      )
    );

    try {
      await api.updateTask(Number(id), {
        owner_id: caregiverIds[owner],
        actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID,
      });

      void api.getTimeline()
        .then((events) => setTimeline(events.map(mapTimelineEvent)))
        .catch((error) => {
          console.warn("Timeline refresh failed:", error);
        });
    } catch (error) {
      setTasks((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, owner: previousOwner }
            : item
        )
      );

      throw error;
    }
  }
  async function createHandoff(
    handoff: Omit<DemoHandoff, "id" | "stage" | "created">
  ) {
    const created = await api.createHandoff({
      patient_id: DEMO_PATIENT_ID,
      title: handoff.title,
      from_caregiver_id: caregiverIds[handoff.from],
      to_caregiver_id: caregiverIds[handoff.to],
      reason: handoff.reason,
      actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID,
    });

    const newHandoff: DemoHandoff = {
      ...handoff,
      id: String(created.id),
      stage:
        created.status === "Completed"
          ? "Completed"
          : created.status === "Acknowledged"
            ? "Acknowledged"
            : created.status === "Prepared"
              ? "Prepared"
              : "Sent",
      created: new Date(created.created_at).toLocaleDateString(
        "en-GB",
        {
          day: "numeric",
          month: "short",
        }
      ),
    };

    setHandoffs((previous) => [
      newHandoff,
      ...previous.filter((item) => item.id !== newHandoff.id),
    ]);

    void api.getTimeline()
      .then((events) => setTimeline(events.map(mapTimelineEvent)))
      .catch((error) => {
        console.warn("Timeline refresh failed:", error);
      });

    return String(created.id);
  }
  async function sendHandoff(id: string) {
    const handoff = handoffs.find((item) => item.id === id);

    if (!handoff) {
      throw new Error("Handoff not found.");
    }

    const previousStage = handoff.stage;

    setHandoffs((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, stage: "Sent" }
          : item
      )
    );

    try {
      await api.sendHandoff(Number(id));

      void api.getTimeline()
        .then((events) => setTimeline(events.map(mapTimelineEvent)))
        .catch((error) => {
          console.warn("Timeline refresh failed:", error);
        });
    } catch (error) {
      setHandoffs((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, stage: previousStage }
            : item
        )
      );

      throw error;
    }
  }

  async function acknowledgeHandoff(id: string) {
    const handoff = handoffs.find((item) => item.id === id);

    if (!handoff) {
      throw new Error("Handoff not found.");
    }

    const previousStage = handoff.stage;

    setHandoffs((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, stage: "Acknowledged" }
          : item
      )
    );

    try {
      await api.acknowledgeHandoff(
        Number(id),
        caregiverIds[handoff.to]
      );

      void api.getTimeline()
        .then((events) => setTimeline(events.map(mapTimelineEvent)))
        .catch((error) => {
          console.warn("Timeline refresh failed:", error);
        });
    } catch (error) {
      setHandoffs((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, stage: previousStage }
            : item
        )
      );

      throw error;
    }
  }

  async function completeHandoff(id: string) {
    const handoff = handoffs.find((item) => item.id === id);

    if (!handoff) {
      throw new Error("Handoff not found.");
    }

    const previousStage = handoff.stage;

    setHandoffs((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, stage: "Completed" }
          : item
      )
    );

    try {
      await api.completeHandoff(
        Number(id),
        caregiverIds[handoff.to]
      );

      void api.getTimeline()
        .then((events) => setTimeline(events.map(mapTimelineEvent)))
        .catch((error) => {
          console.warn("Timeline refresh failed:", error);
        });
    } catch (error) {
      setHandoffs((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, stage: previousStage }
            : item
        )
      );

      throw error;
    }
  }
  async function updateConsentPermission(
    caregiver: DemoOwner,
    permission: PermissionName,
    enabled: boolean
  ) {
    if (caregiver === "Ananya Rao") {
      throw new Error(
        "Patient permissions cannot be managed as caregiver permissions."
      );
    }

    const permissionCaregiverIds: Record<
      Exclude<DemoOwner, "Ananya Rao">,
      number
    > = {
      "Rahul Rao": 1,
      "Lakshmi Rao": 2,
      "Priya Rao": 3,
    };

    const previousEnabled =
      permissions[caregiver][permission];

    setError("");

    setPermissions((previous) => ({
      ...previous,
      [caregiver]: {
        ...previous[caregiver],
        [permission]: enabled,
      },
    }));

    try {
      await api.updatePermission({
        patient_id: DEMO_PATIENT_ID,
        caregiver_id:
          permissionCaregiverIds[caregiver],
        permission_name: permission,
        enabled,
        actor_caregiver_id:
          DEMO_ACTOR_CAREGIVER_ID,
      });

      void api.getTimeline()
        .then((events) => setTimeline(events.map(mapTimelineEvent)))
        .catch((error) => {
          console.warn("Timeline refresh failed:", error);
        });
    } catch (error) {
      setPermissions((previous) => ({
        ...previous,
        [caregiver]: {
          ...previous[caregiver],
          [permission]: previousEnabled,
        },
      }));

      const message =
        error instanceof Error
          ? error.message
          : "Unable to update permission.";

      setError(message);
      throw error;
    }
  }
  const value: MaatruCareDemoContextValue = {
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
      requestHandoffChanges: () =>
        unsupportedMutation(
          "Handoff review requests are not supported by the backend yet."
        ),
      completeHandoff,
      addTimelineEvent: () =>
        unsupportedMutation(
          "Timeline events are recorded by backend mutations."
        ),
      updateConsentPermission,
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

export { initialHandoff };
