import { getSupabaseBrowserClient, readSupabaseSession } from "./supabase";
import { ReadCoalescer } from "./read-coalescer";

export type ApiAuthAccount = {
  phone?: string | null;
  id: number;
  subject: string;
  email: string | null;
  role: "patient" | "caregiver";
  name: string;
  patient_id: number | null;
  caregiver_id: number | null;
  patient?: { id: number; name: string; current_phase: string; is_demo_workspace?: boolean; owner_caregiver_id?: number | null } | null;
  caregiver?: { id: number; name: string; relationship: string; role: string; is_demo: boolean; access_status: string } | null;
};

export type ApiIdentity = {
  patientId: number;
  caregiverId: number;
};

export type ApiCoordinationSummary = {
  summary: string;
  tasks: string[];
  model: string;
  requires_human_review: boolean;
};

export type AIOperation = "summarize" | "extract_tasks" | "appointment_prep" | "handoff_draft" | "update_draft" | "nutrition_notes" | "care_plan";
export type AIDraft = { id: number; operation: AIOperation; status: "Ready" | "Approved" | "Rejected"; created_at: string; review: Record<string, { action?: string; task_id?: number }>; output: { summary: string; facts: Array<{ text: string; source_quote: string }>; dates: string[]; times: string[]; people: string[]; responsibilities: Array<{ text: string; source_quote: string }>; missing_information: string[]; suggestions: Array<{ title: string; kind: string; source_quote: string; assignee_name: string | null; due_date: string | null }>; handoff_title: string | null; handoff_summary: string | null; care_update: string | null } };
export type CoordinationFacts = { source: string; available_categories: string[]; tasks: Array<{ id: number; title: string; owner: string; simulated: boolean; due_date: string; status: string }>; handoffs: Array<{ id: number; title: string; recipient: string; simulated: boolean; status: string }>; appointments: Array<{ id: number; title: string; date: string; time: string; location: string }> };
export type CoordinationAnalytics = { start: string; end: string; tasks: { simulated_tasks: number; eligible: number; completed: number; pending: number; overdue: number } | null; handoffs: { sent: number; acknowledged: number; simulated_acknowledgements: number; average_acknowledgement_minutes: number | null; qualifying_real_acknowledgements: number } | null; caregivers: { accepted: number; simulated: number } };

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
  role: string;
  is_demo: boolean;
  is_patient: boolean;
  email: string | null;
  access_status: string;
  created_at: string;
};

export type ApiCaregiverInvitation = {
  email_status: "not_requested" | "accepted" | "failed" | "unavailable";
  email_accepted_at: string | null;
  id: number;
  email: string;
  name: string | null;
  relationship: string;
  created_at: string;
  accepted_at: string | null;
  withdrawn_at: string | null;
  expires_at: string;
  status: "Pending" | "Accepted" | "Withdrawn" | "Expired";
};

export type ApiPermission = {
  id: number;
  caregiver_id: number;
  permission_name: string;
  enabled: boolean;
  updated_at: string;
};

export type ApiConsentRecord = { id: number; patient_id: number; caregiver_id: number; permission_name: string; action: string; created_at: string };

export type ApiTask = {
  owner_name: string | null;
  owner_is_demo: boolean;
  note: string | null;
  priority: "Low" | "Normal" | "High";
  ai_draft_id: number | null;
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
  cancelled_at: string | null;
  archived_at: string | null;
  context: string | null;
  related_task_id: number | null;
  from_name: string;
  to_name: string;
  from_is_demo: boolean;
  to_is_demo: boolean;
  sent_at: string | null;
  completed_at: string | null;
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
  actor_name?: string | null;
  resource_type?: string | null;
  resource_id?: number | null;
  simulated?: boolean;
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
  nutrition: Array<{ id: number; patient_id: number; log_date: string; meal_type: string; notes: string | null; recommendation_id: number | null; adherence: string | null }>;

  water: Array<{ id: number; patient_id: number; log_date: string; status: string; quantity_ml: number | null; goal_ml: number | null; notes: string | null }>;
  sleep: Array<{ id: number; patient_id: number; log_date: string; status: string; interruptions: number | null; duration_hours: number | null; bedtime: string | null; wake_time: string | null; notes: string | null }>;
  weight: Array<{ id: number; patient_id: number; entry_date: string; weight_kg: number; notes: string | null }>;
  diet_recommendations: Array<{ id: number; patient_id: number; title: string; instructions: string; clinician_name: string | null; start_date: string; end_date: string | null; active: boolean }>;
  diet_adherence: Array<{ id: number; recommendation_id: number; log_date: string; status: string; reason: string | null }>;
  routines: Array<{ id: number; patient_id: number; name: string; activity_type: string; duration_minutes: number | null; advised_source: string | null; active: boolean }>;
  activity_logs: Array<{ id: number; routine_id: number; log_date: string; completed: boolean; completion_status: string | null; planned_minutes: number | null; actual_minutes: number | null; notes: string | null; missed_reason: string | null }>;
  preferences: { id: number; patient_id: number; water_goal_ml: number | null; sleep_goal_minutes: number | null; updated_at: string };
};

export type ApiHandoffCreate = {
  context?: string;
  related_task_id?: number;
  ai_draft_id?: number;
  human_approved?: boolean;
  patient_id: number;
  title: string;
  from_caregiver_id: number;
  to_caregiver_id: number;
  reason: string;
  actor_caregiver_id: number;
};

export type ApiTaskCreate = {
  note?: string;
  priority?: "Low" | "Normal" | "High";
  ai_draft_id?: number;
  ai_suggestion_index?: number;
  human_approved?: boolean;
  patient_id: number;
  title: string;
  owner_id?: number;
  owner_patient_id?: number;
  due_date: string;
  category: string;
  actor_caregiver_id: number;
};

export type ApiTaskUpdate = {
  note?: string;
  priority?: "Low" | "Normal" | "High";
  status?: "Open" | "In progress" | "Completed";
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
let refreshSessionRequest: { subject: string; promise: Promise<string | null> } | null = null;
const concurrentReads = new ReadCoalescer();

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function identityQuery(identity: ApiIdentity) {
  return `patient_id=${identity.patientId}&actor_caregiver_id=${identity.caregiverId}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await readSupabaseSession();
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    concurrentReads.invalidate();
    try { return await executeRequest<T>(path, init, session); }
    finally { concurrentReads.invalidate(); }
  }
  // Custom headers/signals may belong to a single consumer; never combine them.
  if (init && Object.keys(init).some(key => key !== "method")) return executeRequest<T>(path, init, session);
  const key = `${session?.user.id ?? "anonymous"}\0${session?.access_token ?? ""}\0${method}\0${path}`;
  return concurrentReads.read(key, () => executeRequest<T>(path, init, session));
}

async function executeRequest<T>(path: string, init: RequestInit | undefined, session: Awaited<ReturnType<typeof readSupabaseSession>>): Promise<T> {
  const supabase = getSupabaseBrowserClient();
  const subject = session?.user.id;
  let accessToken = session?.access_token;

  async function send() {
    try { return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
      cache: "no-store",
      signal: init?.signal ?? AbortSignal.timeout(35000),
    }); } catch (error) {
      if (error instanceof DOMException && ["TimeoutError", "AbortError"].includes(error.name)) throw new ApiError("The request timed out. Reload your records before retrying a save.", 408);
      throw new ApiError("The care service could not be reached. Check your connection and try again.", 0);
    }
  }

  let response = await send();
  if (response.status === 401 && supabase && subject) {
    const latest = await readSupabaseSession();
    if (latest?.user.id !== subject) throw new ApiError("Your account changed. Reload this page.", 409);
    if (refreshSessionRequest?.subject !== subject) {
      const promise = supabase.auth.refreshSession()
        .then((refreshed) => refreshed.data.session?.user.id === subject ? refreshed.data.session?.access_token ?? null : null);
      refreshSessionRequest = { subject: subject ?? "", promise };
      void promise.finally(() => { if (refreshSessionRequest?.promise === promise) refreshSessionRequest = null; }).catch(() => {});
    }
    const refreshedToken = await refreshSessionRequest!.promise;
    if (refreshedToken && refreshedToken !== accessToken) {
      accessToken = refreshedToken;
      response = await send();
    }
  }

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
      ? Array.isArray(payload.detail)
        ? payload.detail.map((issue: { loc?: string[]; msg?: string }) => `${issue.loc?.slice(1).join(" ") || "Entry"}: ${issue.msg ?? "Invalid value"}`).join("; ")
        : String(payload.detail)
      : `Request failed with status ${response.status}`;
    throw new ApiError(detail, response.status);
  }

  const currentSession = await readSupabaseSession();
  if (currentSession?.user.id !== subject) throw new ApiError("Your account changed. Reload this page.", 409);
  return payload as T;
}

export const api = {
  generateWorkspace: (payload: { note: string; operation: AIOperation; language: string; external_processing_consent: boolean }) => request<AIDraft>("/api/ai/workspace", { method: "POST", body: JSON.stringify(payload) }),
  getAIDrafts: () => request<AIDraft[]>("/api/ai/drafts"),
  getAIDraft: (id: number) => request<AIDraft>(`/api/ai/drafts/${id}`),
  reviewAIDraft: (id: number, payload: { action: "approve" | "reject"; edited_text?: string; suggestion_index?: number }) => request<AIDraft>(`/api/ai/drafts/${id}/review`, { method: "POST", body: JSON.stringify(payload) }),
  getCoordinationFacts: (identity: ApiIdentity) => request<CoordinationFacts>(`/api/analytics/facts?${identityQuery(identity)}`),
  getAnalytics: (identity: ApiIdentity, start: string, end: string) => request<CoordinationAnalytics>(`/api/analytics?${identityQuery(identity)}&start=${start}&end=${end}`),
  getAuthMe: () => request<ApiAuthAccount>("/api/auth/me"),
  updateProfile: (payload: { name: string; phone?: string; current_phase?: string }) =>
    request<ApiAuthAccount>("/api/auth/profile", { method: "PUT", body: JSON.stringify(payload) }),
  bootstrapAccount: (payload: { name: string; role: "patient" | "caregiver"; invitation_token?: string; demo_workspace?: boolean }) =>
    request<ApiAuthAccount>("/api/auth/bootstrap", { method: "POST", body: JSON.stringify(payload) }),
  createCaregiverInvitation: (payload: { email: string; name?: string; relationship?: string; delivery?: "link" | "email" }) =>
    request<{ token: string; email: string; email_status: ApiCaregiverInvitation["email_status"]; email_accepted_at: string | null }>("/api/auth/invitations", { method: "POST", body: JSON.stringify(payload) }),
  invitationDelivery: () => request<{email_available: boolean; simulated_available: boolean; explanation: string}>("/api/auth/invitation-delivery"),
  withdrawCaregiverInvitation: (id: number) => request(`/api/auth/invitations/${id}/withdraw`, { method: "POST" }),
  acceptCaregiverInvitation: (token: string) => request<ApiAuthAccount>(`/api/auth/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" }),
  getCaregiverInvitations: (identity: ApiIdentity) =>
    request<ApiCaregiverInvitation[]>(`/api/auth/invitations?${identityQuery(identity)}`),
  generateCoordinationSummary: (note: string) =>
    request<ApiCoordinationSummary>("/api/ai/coordination-summary", {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  getPatients: (identity: ApiIdentity) => request<ApiPatient[]>(`/api/patients?actor_caregiver_id=${identity.caregiverId}`),
  getCaregivers: (identity: ApiIdentity, scope = "Coordination tasks") => request<ApiCaregiver[]>(`/api/caregivers?actor_caregiver_id=${identity.caregiverId}&scope=${encodeURIComponent(scope)}`),
  createDemoCaregiver: (payload: { patient_id: number; name: string; relationship: string; role: string; email?: string; coordination_access?: boolean; actor_caregiver_id: number }) =>
    request<ApiCaregiver>("/api/caregivers/demo", { method: "POST", body: JSON.stringify(payload) }),
  updateCaregiver: (id: number, payload: { name: string; relationship: string; actor_caregiver_id: number }) => request<ApiCaregiver>(`/api/caregivers/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  removeCaregiver: (id: number, identity: ApiIdentity) => request<ApiCaregiver>(`/api/caregivers/${id}?actor_caregiver_id=${identity.caregiverId}`, { method: "DELETE" }),
  getConsentHistory: (identity: ApiIdentity) => request<ApiConsentRecord[]>(`/api/permissions/history?${identityQuery(identity)}`),
  getPermissions: (identity: ApiIdentity) => request<ApiPermission[]>(`/api/permissions?${identityQuery(identity)}`),
  getTasks: (identity: ApiIdentity) => request<ApiTask[]>(`/api/tasks?actor_caregiver_id=${identity.caregiverId}`),
  getAppointments: (identity: ApiIdentity) => request<ApiAppointment[]>(`/api/appointments?actor_caregiver_id=${identity.caregiverId}`),
  getHandoffs: (identity: ApiIdentity) => request<ApiHandoff[]>(`/api/handoffs?actor_caregiver_id=${identity.caregiverId}&include_archived=true`),
  getTimeline: (identity: ApiIdentity, limit = 15, offset = 0, options: { order: "newest" | "oldest"; category: string; resourceType?: "Task" | "CareHandoff"; resourceId?: number } = { order: "newest", category: "All" }) => request<ApiTimelineEvent[]>(`/api/timeline?actor_caregiver_id=${identity.caregiverId}&limit=${limit}&offset=${offset}&order=${options.order}&category=${encodeURIComponent(options.category)}${options.resourceType ? `&resource_type=${options.resourceType}` : ""}${options.resourceId ? `&resource_id=${options.resourceId}` : ""}`),
  createTask: (payload: ApiTaskCreate) => request<ApiTask>("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (id: number, payload: ApiTaskUpdate) => request<ApiTask>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  completeTask: (id: number, completed: boolean, identity: ApiIdentity) => request<ApiTask>(`/api/tasks/${id}/complete`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: identity.caregiverId, completed }) }),
  deleteTask: (id: number, identity: ApiIdentity) => request<void>(`/api/tasks/${id}`, { method: "DELETE", body: JSON.stringify({ actor_caregiver_id: identity.caregiverId, completed: false }) }),
  createAppointment: (payload: ApiAppointmentCreate) => request<ApiAppointment>("/api/appointments", { method: "POST", body: JSON.stringify(payload) }),
  updateAppointment: (id: number, payload: ApiAppointmentUpdate) => request<ApiAppointment>(`/api/appointments/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  cancelAppointment: (id: number, identity: ApiIdentity) => request<ApiAppointment>(`/api/appointments/${id}/cancel`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: identity.caregiverId }) }),
  createHandoff: (payload: ApiHandoffCreate) => request<ApiHandoff>("/api/handoffs", { method: "POST", body: JSON.stringify(payload) }),
  sendHandoff: (id: number, identity: ApiIdentity) => request<ApiHandoff>(`/api/handoffs/${id}/send`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: identity.caregiverId }) }),
  acknowledgeHandoff: (id: number, identity: ApiIdentity) => request<ApiHandoff>(`/api/handoffs/${id}/acknowledge`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: identity.caregiverId }) }),
  removeHandoff: (id: number, identity: ApiIdentity, expectedStatus: string) => request<ApiHandoff>(`/api/handoffs/${id}/remove`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: identity.caregiverId, expected_status: expectedStatus }) }),
  completeHandoff: (id: number, identity: ApiIdentity) => request<ApiHandoff>(`/api/handoffs/${id}/complete`, { method: "POST", body: JSON.stringify({ actor_caregiver_id: identity.caregiverId }) }),
  updatePermission: (payload: ApiPermissionUpdate) => request<ApiPermission>("/api/permissions", { method: "PUT", body: JSON.stringify(payload) }),
  getLifestyle: (identity: ApiIdentity) => request<LifestyleData>(`/api/lifestyle?${identityQuery(identity)}`),
  createNutrition: (payload: Record<string, unknown>) => request("/api/lifestyle/nutrition", { method: "POST", body: JSON.stringify(payload) }),
  createWater: (payload: Record<string, unknown>) => request("/api/lifestyle/water", { method: "POST", body: JSON.stringify(payload) }),
  updateWater: (id: number, payload: Record<string, unknown>) => request(`/api/lifestyle/water/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteWater: (id: number, identity?: ApiIdentity) => request(`/api/lifestyle/water/${id}${identity ? `?actor_caregiver_id=${identity.caregiverId}` : ""}`, { method: "DELETE" }),
  deleteSleep: (id: number, identity: ApiIdentity) => request(`/api/lifestyle/sleep/${id}?actor_caregiver_id=${identity.caregiverId}`, { method: "DELETE" }),
  deleteWeight: (id: number, identity?: ApiIdentity) => request(`/api/lifestyle/weight/${id}${identity ? `?actor_caregiver_id=${identity.caregiverId}` : ""}`, { method: "DELETE" }),
  deleteDietAdherence: (id: number, identity: ApiIdentity) => request(`/api/lifestyle/diet/adherence/${id}?actor_caregiver_id=${identity.caregiverId}`, { method: "DELETE" }),
  deleteActivityLog: (id: number, identity: ApiIdentity) => request(`/api/lifestyle/activities/logs/${id}?actor_caregiver_id=${identity.caregiverId}`, { method: "DELETE" }),
  archiveRoutine: (id: number, identity?: ApiIdentity) => request(`/api/lifestyle/activities/routines/${id}${identity ? `?actor_caregiver_id=${identity.caregiverId}` : ""}`, { method: "DELETE" }),
  updateLifestylePreferences: (payload: Record<string, unknown>) => request("/api/lifestyle/preferences", { method: "PUT", body: JSON.stringify(payload) }),
  previewLifestyleReset: (identity: ApiIdentity, resetPreferences: boolean) => request<{ enabled: boolean; counts: Record<string, number>; explanation: string }>(`/api/lifestyle/reset-preview?${identityQuery(identity)}&reset_preferences=${resetPreferences}`),
  resetLifestyle: (payload: Record<string, unknown>) => request<{ deleted: Record<string, number>; preferences_reset: boolean }>("/api/lifestyle/reset", { method: "POST", body: JSON.stringify(payload) }),
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
