export type ApiPatient = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  current_phase: string;
  created_at: string;
};

export type ApiCaregiver = {
  id: number;
  patient_id: number;
  name: string;
  relationship: string;
  email: string | null;
  access_status: string;
  created_at: string;
};

export type ApiPermission = {
  id: number;
  caregiver_id: number;
  permission_name: string;
  enabled: boolean;
  updated_at: string;
};

export type ApiTask = {
  id: number;
  patient_id: number;
  title: string;
  owner_id: number | null;
  owner_patient_id: number | null;
  due_date: string;
  category: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export type ApiAppointment = {
  id: number;
  patient_id: number;
  title: string;
  clinician_name: string;
  location: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
};

export type ApiHandoff = {
  id: number;
  patient_id: number;
  title: string;
  from_caregiver_id: number;
  to_caregiver_id: number;
  reason: string;
  status: string;
  created_at: string;
  acknowledged_at: string | null;
};

export type ApiTimelineEvent = {
  id: number;
  patient_id: number;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string;
  source: string | null;
  created_at: string;
};

export type ApiHandoffCreate = {
  patient_id: number;
  title: string;
  from_caregiver_id: number;
  to_caregiver_id: number;
  reason: string;
  actor_caregiver_id: number;
};

export type ApiTaskCreate = {
  patient_id: number;
  title: string;
  owner_id?: number;
  owner_patient_id?: number;
  due_date: string;
  category: string;
  actor_caregiver_id: number;
};

export type ApiTaskUpdate = {
  title?: string;
  owner_id?: number;
  owner_patient_id?: number;
  due_date?: string;
  category?: string;
  actor_caregiver_id: number;
};

export type ApiAppointmentCreate = {
  patient_id: number;
  title: string;
  clinician_name: string;
  location: string;
  appointment_date: string;
  appointment_time: string;
  status?: string;
  actor_caregiver_id: number;
};

export type ApiAppointmentUpdate = Partial<Omit<ApiAppointmentCreate, "patient_id" | "actor_caregiver_id">> & { actor_caregiver_id: number };

export type ApiPermissionUpdate = {
  patient_id: number;
  caregiver_id: number;
  permission_name: string;
  enabled: boolean;
  actor_caregiver_id: number;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

export const DEMO_PATIENT_ID = 1;
export const DEMO_ACTOR_CAREGIVER_ID = Number(process.env.NEXT_PUBLIC_DEMO_ACTOR_CAREGIVER_ID ?? "1");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  const body = await response.text();
  let payload: unknown = null;
  if (body) {
    try {
      payload = JSON.parse(body);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const detail = typeof payload === "object" && payload !== null && "detail" in payload
      ? String(payload.detail)
      : `Request failed with status ${response.status}`;
    throw new ApiError(detail, response.status);
  }

  return payload as T;
}

export const api = {
  getPatients: () => request<ApiPatient[]>(`/api/patients?actor_caregiver_id=${DEMO_ACTOR_CAREGIVER_ID}`),
  getCaregivers: () => request<ApiCaregiver[]>(`/api/caregivers?actor_caregiver_id=${DEMO_ACTOR_CAREGIVER_ID}`),
  getPermissions: () => request<ApiPermission[]>(`/api/permissions?patient_id=${DEMO_PATIENT_ID}&actor_caregiver_id=${DEMO_ACTOR_CAREGIVER_ID}`),
  getTasks: () => request<ApiTask[]>(`/api/tasks?actor_caregiver_id=${DEMO_ACTOR_CAREGIVER_ID}`),
  getAppointments: () => request<ApiAppointment[]>(`/api/appointments?actor_caregiver_id=${DEMO_ACTOR_CAREGIVER_ID}`),
  getHandoffs: () => request<ApiHandoff[]>(`/api/handoffs?actor_caregiver_id=${DEMO_ACTOR_CAREGIVER_ID}`),
  getTimeline: () => request<ApiTimelineEvent[]>(`/api/timeline?actor_caregiver_id=${DEMO_ACTOR_CAREGIVER_ID}`),
  createTask: (payload: ApiTaskCreate) => request<ApiTask>("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (id: number, payload: ApiTaskUpdate) => request<ApiTask>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  completeTask: (id: number, completed: boolean) => request<ApiTask>(`/api/tasks/${id}/complete`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID, completed }) }),
  createAppointment: (payload: ApiAppointmentCreate) => request<ApiAppointment>("/api/appointments", { method: "POST", body: JSON.stringify(payload) }),
  updateAppointment: (id: number, payload: ApiAppointmentUpdate) => request<ApiAppointment>(`/api/appointments/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  cancelAppointment: (id: number) => request<ApiAppointment>(`/api/appointments/${id}/cancel`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID }) }),
  createHandoff: (payload: ApiHandoffCreate) => request<ApiHandoff>("/api/handoffs", { method: "POST", body: JSON.stringify(payload) }),
  sendHandoff: (id: number) => request<ApiHandoff>(`/api/handoffs/${id}/send`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: DEMO_ACTOR_CAREGIVER_ID }) }),
  acknowledgeHandoff: (id: number, actorCaregiverId: number) => request<ApiHandoff>(`/api/handoffs/${id}/acknowledge`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: actorCaregiverId }) }),
  updatePermission: (payload: ApiPermissionUpdate) => request<ApiPermission>("/api/permissions", { method: "PUT", body: JSON.stringify(payload) }),
};