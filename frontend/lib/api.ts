export type ApiCoordinationSummary = {
  summary: string;
  tasks: string[];
  model: string;
  requires_human_review: boolean;
};

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

export type LifestyleData = {
  water: Array<{ id: number; patient_id: number; log_date: string; status: string; quantity_ml: number | null; goal_ml: number | null; notes: string | null }>;
  sleep: Array<{ id: number; patient_id: number; log_date: string; status: string; duration_hours: number | null; bedtime: string | null; wake_time: string | null; notes: string | null }>;
  weight: Array<{ id: number; patient_id: number; entry_date: string; weight_kg: number; notes: string | null }>;
  diet_recommendations: Array<{ id: number; patient_id: number; title: string; instructions: string; clinician_name: string | null; start_date: string; end_date: string | null; active: boolean }>;
  diet_adherence: Array<{ id: number; recommendation_id: number; log_date: string; status: string; reason: string | null }>;
  routines: Array<{ id: number; patient_id: number; name: string; activity_type: string; duration_minutes: number | null; advised_source: string | null; active: boolean }>;
  activity_logs: Array<{ id: number; routine_id: number; log_date: string; completed: boolean; completion_status: string | null; actual_minutes: number | null; notes: string | null; missed_reason: string | null }>;
  preferences: { id: number; patient_id: number; water_goal_ml: number | null; sleep_goal_minutes: number | null; updated_at: string };
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
  owner_id?: number | null;
  owner_patient_id?: number | null;
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
  generateCoordinationSummary: (note: string) =>
    request<ApiCoordinationSummary>("/api/ai/coordination-summary", {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
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
  completeHandoff: (id: number, actorCaregiverId: number) => request<ApiHandoff>(`/api/handoffs/${id}/complete`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: actorCaregiverId }) }),
  updatePermission: (payload: ApiPermissionUpdate) => request<ApiPermission>("/api/permissions", { method: "PUT", body: JSON.stringify(payload) }),
  getLifestyle: () => request<LifestyleData>(`/api/lifestyle?patient_id=${DEMO_PATIENT_ID}&actor_caregiver_id=${DEMO_ACTOR_CAREGIVER_ID}`),
  createWater: (payload: Record<string, unknown>) => request("/api/lifestyle/water", { method: "POST", body: JSON.stringify(payload) }),
  updateWater: (id: number, payload: Record<string, unknown>) => request(`/api/lifestyle/water/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteWater: (id: number) => request(`/api/lifestyle/water/${id}?actor_caregiver_id=${DEMO_ACTOR_CAREGIVER_ID}`, { method: "DELETE" }),
  updateLifestylePreferences: (payload: Record<string, unknown>) => request("/api/lifestyle/preferences", { method: "PUT", body: JSON.stringify(payload) }),
  createSleep: (payload: Record<string, unknown>) => request("/api/lifestyle/sleep", { method: "POST", body: JSON.stringify(payload) }),
  updateSleep: (id: number, payload: Record<string, unknown>) => request(`/api/lifestyle/sleep/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  createWeight: (payload: Record<string, unknown>) => request("/api/lifestyle/weight", { method: "POST", body: JSON.stringify(payload) }),
  updateWeight: (id: number, payload: Record<string, unknown>) => request(`/api/lifestyle/weight/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  createDietRecommendation: (payload: Record<string, unknown>) => request("/api/lifestyle/diet/recommendations", { method: "POST", body: JSON.stringify(payload) }),
  updateDietRecommendation: (id: number, payload: Record<string, unknown>) => request(`/api/lifestyle/diet/recommendations/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  createRoutine: (payload: Record<string, unknown>) => request("/api/lifestyle/activities/routines", { method: "POST", body: JSON.stringify(payload) }),
  updateRoutine: (id: number, payload: Record<string, unknown>) => request(`/api/lifestyle/activities/routines/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  createDietAdherence: (id: number, payload: Record<string, unknown>) => request(`/api/lifestyle/diet/recommendations/${id}/adherence`, { method: "POST", body: JSON.stringify(payload) }),
  updateDietAdherence: (id: number, payload: Record<string, unknown>) => request(`/api/lifestyle/diet/adherence/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  createActivityLog: (id: number, payload: Record<string, unknown>) => request(`/api/lifestyle/activities/routines/${id}/logs`, { method: "POST", body: JSON.stringify(payload) }),
  updateActivityLog: (id: number, payload: Record<string, unknown>) => request(`/api/lifestyle/activities/logs/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
};
