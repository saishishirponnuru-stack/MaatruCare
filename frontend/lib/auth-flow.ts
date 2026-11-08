import type { EmailOtpType, Session, SupabaseClient } from "@supabase/supabase-js";

type Auth = SupabaseClient["auth"];
const destinations = new Set(["/dashboard", "/onboarding", "/profile", "/care-circle", "/consent", "/tasks", "/handoffs", "/timeline", "/journey", "/appointments", "/lifestyle", "/ai-assist", "/settings"]);

export function safeAuthNext(value?: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://maatrucare.invalid");
    if (url.origin !== "https://maatrucare.invalid" || !destinations.has(url.pathname)) return "/dashboard";
    // Only onboarding needs URL state. Never propagate arbitrary callback parameters.
    if (url.pathname !== "/onboarding") return url.pathname;
    const params = new URLSearchParams();
    if (url.searchParams.get("role") === "caregiver") params.set("role", "caregiver");
    const invitation = url.searchParams.get("invitation");
    if (invitation && invitation.length <= 512 && /^[a-zA-Z0-9_-]+$/.test(invitation)) params.set("invitation", invitation);
    return `/onboarding${params.size ? `?${params}` : ""}`;
  } catch { return "/dashboard"; }
}

export function onboardingDestination(next?: string | null) {
  const safe = safeAuthNext(next);
  return safe.startsWith("/onboarding") ? safe : "/onboarding";
}

export function authDestination(linked: boolean, next?: string | null) {
  const safe = safeAuthNext(next);
  // A valid invitation is an explicit join intent, even for an existing user.
  // Do not mistake a linked profile for successful invitation acceptance.
  if (safe.startsWith("/onboarding?") && new URLSearchParams(safe.split("?")[1]).has("invitation")) return safe;
  return linked ? safe.startsWith("/onboarding") ? "/dashboard" : safe : onboardingDestination(safe);
}

export function callbackUrl(origin: string, next?: string | null, recovery = false) {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", recovery ? "/reset-password" : safeAuthNext(next));
  if (recovery) url.searchParams.set("type", "recovery");
  return url.toString();
}

export function validateEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function validatePassword(password: string, confirmation: string) {
  if (password.length < 8 || password.length > 128) throw new Error("Use between 8 and 128 characters for your password.");
  if (password !== confirmation) throw new Error("The passwords do not match.");
}

export function authErrorMessage(error: unknown): string {
  const detail = error as {code?: string; status?: number; name?: string; message?: string} | null;
  const legacyCodes: Record<string,string> = {"Invalid login credentials":"invalid_credentials", "Email not confirmed":"email_not_confirmed", "User already registered":"user_already_exists", "Email address not authorized":"email_address_not_authorized"};
  const code = detail?.code ?? legacyCodes[detail?.message ?? ""];
  if (code === "invalid_credentials" || code === "user_not_found" || code === "invalid_grant") return "Email or password was not accepted. Check your details, confirm your email if needed, or reset your password.";
  if (code === "email_not_confirmed") return "Confirm your email before signing in. You can request another confirmation link below.";
  if (detail?.status === 429 || code?.includes("rate_limit") || code === "over_email_send_rate_limit") return "Too many requests. Please wait before trying again.";
  if (code === "email_address_not_authorized" || code === "email_provider_disabled" || code === "signup_disabled") return "Email registration is unavailable in this environment. Contact the MaatruCare team or use Google sign-in.";
  if (code === "unexpected_failure" || code === "email_send_failed") return "The email service could not accept this request. Please try later or contact the MaatruCare team.";
  if (code === "email_exists" || code === "user_already_exists") return "Registration could not be completed. Try signing in or requesting password recovery.";
  if (code === "weak_password") return "Choose a stronger password. Follow the password requirements configured for this service.";
  if (code === "same_password") return "Choose a password different from your current password.";
  if (code === "otp_expired" || code === "flow_state_expired" || code === "flow_state_not_found" || code === "bad_code_verifier" || code === "pkce_code_verifier_not_found" || detail?.name === "AuthPKCECodeVerifierMissingError" || code === "validation_failed") return "This link has expired, was already used, or was opened in a different browser. Request a new link, or sign in if you already confirmed your email.";
  if (code === "reauthentication_needed") return "Please request a new password recovery link before changing your password.";
  if (detail?.name === "AuthRetryableFetchError" || detail?.name === "TypeError" || detail?.status === 0) return "The sign-in service could not be reached. Check your connection and try again.";
  // Preserve our own validation errors, but never reflect provider or URL error text.
  if (error instanceof Error && error.name === "Error" && !code && detail?.status === undefined) return error.message;
  return "Account access could not be completed. Please try again or use password recovery.";
}

function rejected(error: unknown): never { throw new Error(authErrorMessage(error)); }

export async function registerWithEmail(auth: Auth, input: {email: string; password: string; confirmation: string; name: string; role: "patient"|"caregiver"; invitation?: string}, origin: string) {
  validatePassword(input.password, input.confirmation);
  const email = validateEmail(input.email);
  const name = input.name.trim();
  if (!name || name.length > 200) throw new Error("Enter your name using up to 200 characters.");
  if (input.role === "caregiver" && !input.invitation?.trim()) throw new Error("Enter the invitation code shared by the Care Circle owner.");
  const next = input.role === "caregiver" ? `/onboarding?role=caregiver&invitation=${encodeURIComponent(input.invitation!.trim())}` : "/onboarding";
  const {data,error} = await auth.signUp({email,password:input.password,options:{data:{name,role:input.role},emailRedirectTo:callbackUrl(origin,next)}});
  if (error) rejected(error);
  if (!data.user && !data.session) throw new Error("Registration could not be confirmed. Please try again.");
  return {confirmationRequired: !data.session, next};
}

export async function signInWithEmail(auth: Auth, email: string, password: string): Promise<Session> {
  if (!password) throw new Error("Enter your password.");
  const {data,error} = await auth.signInWithPassword({email:validateEmail(email),password});
  if (error) rejected(error);
  if (!data.session) throw new Error("Sign-in did not return an active session. Please try again.");
  return data.session;
}

export async function resendConfirmation(auth: Auth, email: string, origin: string, next?: string | null) {
  const {error} = await auth.resend({type:"signup",email:validateEmail(email),options:{emailRedirectTo:callbackUrl(origin,onboardingDestination(next))}});
  if (error) rejected(error);
}

export async function requestRecovery(auth: Auth, email: string, origin: string) {
  const {error} = await auth.resetPasswordForEmail(validateEmail(email),{redirectTo:callbackUrl(origin,null,true)});
  if (error) rejected(error);
}

export function hasAuthLink(url: URL) {
  const hash = new URLSearchParams(url.hash.slice(1));
  return ["code","token_hash","error","error_description","error_code"].some((key)=>url.searchParams.has(key)||hash.has(key)) || hash.has("access_token");
}

export function scrubAuthUrl(href: string) {
  const url = new URL(href);
  for (const key of ["code","sb_flow_id","token_hash","access_token","refresh_token","error","error_description","error_code"]) url.searchParams.delete(key);
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

export async function resolveAuthLink(auth: Auth, href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (["error","error_description","error_code"].some((key)=>url.searchParams.has(key)||hash.has(key))) throw new Error("This sign-in link could not be verified. Request a new link or return to sign in.");
  const type = url.searchParams.get("type") ?? hash.get("type");
  let recovery = type === "recovery" || url.pathname === "/reset-password" || url.searchParams.get("next") === "/reset-password";
  let session: Session | null = null;
  if (url.searchParams.has("code")) {
    // Process a new authorization code even if another account already has a session.
    const {data,error} = await auth.exchangeCodeForSession(url.searchParams.get("code")!,url.searchParams.get("sb_flow_id")?{flowId:url.searchParams.get("sb_flow_id")!}:undefined);
    if (error) rejected(error);
    session = data.session;
    recovery ||= "redirectType" in data && data.redirectType === "recovery";
  } else if (url.searchParams.has("token_hash")) {
    if (!["signup","email","recovery","invite"].includes(type??"")) throw new Error("This confirmation link is not supported. Request a new link.");
    const {data,error} = await auth.verifyOtp({token_hash:url.searchParams.get("token_hash")!,type:type as EmailOtpType});
    if (error) rejected(error);
    session = data.session;
  } else if (hash.has("access_token") && hash.has("refresh_token")) {
    // Backward compatibility for previously issued implicit confirmation/recovery links.
    const {data,error} = await auth.setSession({access_token:hash.get("access_token")!,refresh_token:hash.get("refresh_token")!});
    if (error) rejected(error);
    session = data.session;
  } else {
    throw new Error("This page needs a valid confirmation or sign-in link. Return to sign in or request a new link.");
  }
  if (!session) throw new Error("The link did not return an active session. Request a new link.");
  const verified = await auth.getUser();
  if (verified.error) rejected(verified.error);
  if (verified.data.user?.id !== session.user.id) throw new Error("Your account changed. Start the sign-in flow again.");
  return {session,recovery,next:safeAuthNext(url.searchParams.get("next"))};
}

export async function changePassword(auth: Auth, password: string, confirmation: string, expectedSubject: string) {
  validatePassword(password,confirmation);
  const current = await auth.getUser();
  if (current.error || !current.data.user) throw new Error("Open a fresh password recovery link to continue.");
  if (current.data.user.id !== expectedSubject) throw new Error("Your account changed. Request a new recovery link for the correct account.");
  const {error} = await auth.updateUser({password});
  if (error) rejected(error);
}

export async function signOutCurrentSession(auth: Auth) {
  const {error} = await auth.signOut({scope:"local"});
  if (error) rejected(error);
}
