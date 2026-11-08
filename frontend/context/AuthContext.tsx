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
import { usePathname, useRouter } from "next/navigation";
import { ApiError, api, type ApiAuthAccount } from "@/lib/api";
import { authDestination, authErrorMessage, callbackUrl, changePassword, hasAuthLink, registerWithEmail, requestRecovery, resendConfirmation, resolveAuthLink, safeAuthNext, signInWithEmail, signOutCurrentSession } from "@/lib/auth-flow";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  readSupabaseSession,
} from "@/lib/supabase";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "unconfigured";

type AuthContextValue = {
  status: AuthStatus;
  account: ApiAuthAccount | null;
  email: string | null;
  suggestedName: string;
  signIn: (email: string, password: string, nextPath?: string) => Promise<void>;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  signUp: (email: string, password: string, confirmation: string, name: string, role: "patient" | "caregiver", invitationToken?: string) => Promise<{confirmationRequired: boolean; next: string}>;
  resendVerification: (email: string, nextPath?: string) => Promise<void>;
  prepareRecovery: (href: string) => Promise<{subject: string; email: string}>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string, confirmation: string, expectedSubject: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<ApiAuthAccount | null>;
  completeAuthCallback: (href: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const publicPaths = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth/callback"];

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const client = getSupabaseBrowserClient();
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? "loading" : "unconfigured",
  );
  const [accountReady,setAccountReady]=useState(false);
  const [account, setAccount] = useState<ApiAuthAccount | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [suggestedName,setSuggestedName]=useState("");
  const [authError, setAuthError] = useState("");
  const redirectIntentRef=useRef<string|null>(null);
  const subjectRef = useRef<string | null>(null);
  const loadedSubjectRef = useRef<string | null>(null);
  const callbackRequestRef = useRef<{href: string; promise: ReturnType<typeof resolveAuthLink>} | null>(null);
  const accountRequestRef = useRef<{ subject: string; promise: Promise<ApiAuthAccount | null> } | null>(null);

  const refreshAccount = useCallback(async () => {
    const session = await readSupabaseSession().catch((error) => { setAuthError(error instanceof Error ? error.message : "Session unavailable"); throw error; });
    const subject = session?.user.id;
    if (!subject) { subjectRef.current = null; loadedSubjectRef.current = null; accountRequestRef.current = null; setAccount(null); setAccountReady(false); setEmail(null); setStatus("unauthenticated"); return null; }
    if (subjectRef.current !== subject) {
      subjectRef.current = subject;
      accountRequestRef.current = null;
      setAccountReady(false);setAccount(null);
    }
    if (accountRequestRef.current?.subject === subject) return accountRequestRef.current.promise;
    const request = (async () => {
      try {
        const current = await api.getAuthMe();
        if (subjectRef.current !== subject || current.subject !== subject) return null;
        setAuthError("");
        loadedSubjectRef.current = subject;
        // Keep the identity snapshot stable when an explicit refresh returns
        // unchanged data. Replacing it restarts every workspace effect.
        setAccount(previous => JSON.stringify(previous) === JSON.stringify(current) ? previous : current);setAccountReady(true);
        return current;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          if (subjectRef.current === subject) { setAccount(null); setAccountReady(true); setAuthError(""); }
          return null;
        }
        if (subjectRef.current === subject) setAuthError(error instanceof Error ? error.message : "Your account could not be loaded.");
        throw error;
      } finally {
        if (accountRequestRef.current?.subject === subject) accountRequestRef.current = null;
      }
    })();
    accountRequestRef.current = { subject, promise: request };
    return request;
  }, []);

  useEffect(() => {
    if (!client) {
      return;
    }
    const supabaseClient = client;

    let active = true;

    async function restoreSession() {
      let session;
      try { session = await readSupabaseSession(); } catch (error) {
        if (active) { setAuthError(error instanceof Error ? error.message : "Session unavailable"); setStatus("authenticated"); }
        return;
      }
      if (!active) return;

      if (!session) {
        setStatus("unauthenticated");
        setAccount(null);
        subjectRef.current = null;
        setEmail(null);
        return;
      }

      setEmail(session.user.email ?? null);
      const restoredSubject = session.user.id;
      try {
        await refreshAccount();
        if (active && subjectRef.current === restoredSubject) setStatus("authenticated");
      } catch (error) {
        if (active && subjectRef.current === restoredSubject) {
          setStatus(error instanceof ApiError && error.status === 401
            ? "unauthenticated"
            : "authenticated");
        }
      }
    }

    void restoreSession();
    const { data: subscription } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const subject = session?.user.id ?? null;
      const changed = subjectRef.current !== subject;
      if (changed) {
        subjectRef.current = subject;
        loadedSubjectRef.current = null;
        accountRequestRef.current = null;
        setAccount(null);setAccountReady(false);
        setAuthError("");
      }
      setEmail(session?.user.email ?? null);
      const metadataName=session?.user.user_metadata?.name??session?.user.user_metadata?.full_name;
      setSuggestedName(typeof metadataName==="string"?metadataName.slice(0,200):"");
      if (!session) { loadedSubjectRef.current = null; setStatus("unauthenticated"); return; }
      if (!changed && event === "SIGNED_IN" && loadedSubjectRef.current === subject) return;
      if (!changed && event !== "USER_UPDATED" && event !== "SIGNED_IN") return;
      if (changed) setStatus("loading");
      // Leave the Supabase auth callback before requesting session-backed data.
      window.setTimeout(() => {
        if (!active || subjectRef.current !== subject) return;
        void refreshAccount()
          .then(() => { if (active && subjectRef.current === subject) setStatus("authenticated"); })
          .catch(() => { if (active && subjectRef.current === subject) { setAccount(null); setStatus("authenticated"); } });
      }, 0);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [client, refreshAccount]);

  useEffect(() => {
    if (!isSupabaseConfigured || status === "loading" || isPublicPath(pathname)) {
      return;
    }
    if (status === "unauthenticated") {
      router.replace(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [pathname, router, status]);

  useEffect(() => {
    if (status !== "authenticated" || !accountReady || authError || !["/sign-in", "/sign-up"].includes(pathname)) return;
    router.replace(authDestination(Boolean(account), redirectIntentRef.current ?? new URLSearchParams(window.location.search).get("next")));
  }, [status, account, accountReady, authError, pathname, router]);

  const clearIdentity = useCallback(() => {
    redirectIntentRef.current=null;subjectRef.current = null; loadedSubjectRef.current = null; accountRequestRef.current = null;
    setAccount(null); setAccountReady(false); setEmail(null); setSuggestedName(""); setAuthError(""); setStatus("unauthenticated");
  }, []);

  const resolveLinkOnce = useCallback(async (href: string) => {
    if (!client) throw new Error("Authentication is not configured.");
    if (callbackRequestRef.current?.href !== href) {
      callbackRequestRef.current = {href, promise: resolveAuthLink(client.auth, href)};
    }
    return callbackRequestRef.current.promise;
  }, [client]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    account,
    email,
    suggestedName,
    async signIn(signInEmail, password, nextPath = "/dashboard") {
      if (!client) throw new Error("Authentication is not configured.");
      setAuthError("");redirectIntentRef.current=safeAuthNext(nextPath);
      const session = await signInWithEmail(client.auth, signInEmail, password);
      const current = await refreshAccount();
      if(subjectRef.current!==session.user.id)throw new Error("Your account changed. Please sign in again.");
      setStatus("authenticated");
      router.replace(authDestination(Boolean(current),nextPath));
    },
    async signInWithGoogle(nextPath = "/dashboard") {
      if (!client) throw new Error("Authentication is not configured.");
      const {error} = await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:callbackUrl(window.location.origin,safeAuthNext(nextPath))}});
      if (error) throw new Error(authErrorMessage(error));
    },
    async signUp(signUpEmail, password, confirmation, name, role, invitationToken) {
      if (!client) throw new Error("Authentication is not configured.");
      const result = await registerWithEmail(client.auth,{email:signUpEmail,password,confirmation,name,role,invitation:invitationToken},window.location.origin);
      redirectIntentRef.current=result.next;
      if (!result.confirmationRequired) {
        await refreshAccount();
        setStatus("authenticated");
        router.replace(result.next);
      }
      return result;
    },
    async resendVerification(verificationEmail, nextPath) {
      if (!client) throw new Error("Authentication is not configured.");
      await resendConfirmation(client.auth,verificationEmail,window.location.origin,nextPath);
    },
    async sendPasswordReset(resetEmail) {
      if (!client) throw new Error("Authentication is not configured.");
      await requestRecovery(client.auth,resetEmail,window.location.origin);
    },
    async prepareRecovery(href) {
      if (!client) throw new Error("Authentication is not configured.");
      const url = new URL(href);
      if (hasAuthLink(url)) {
        const result = await resolveLinkOnce(href);
        if (!result.recovery) throw new Error("Use a password recovery link to change your password.");
      }
      const {data,error} = await client.auth.getUser();
      if (error || !data.user) throw new Error("Open a fresh password recovery link to continue.");
      return {subject:data.user.id,email:data.user.email??"your account"};
    },
    async updatePassword(password, confirmation, expectedSubject) {
      if (!client) throw new Error("Authentication is not configured.");
      await changePassword(client.auth,password,confirmation,expectedSubject);
      const {error} = await client.auth.signOut({scope:"local"});
      if (error) throw new Error("Your password was updated, but sign-out could not finish. Sign out before signing in again.");
      clearIdentity();
    },
    async completeAuthCallback(href) {
      const result = await resolveLinkOnce(href);
      setAccount(null); setEmail(result.session.user.email??null); setAuthError("");
      if (result.recovery) { router.replace("/reset-password"); return; }
      const current = await refreshAccount();
      if(subjectRef.current!==result.session.user.id)throw new Error("Your account changed. Please sign in again.");
      setStatus("authenticated");
      router.replace(authDestination(Boolean(current),result.next));
    },
    async signOut() {
      if (!client) return;
      await signOutCurrentSession(client.auth);
      clearIdentity();
      callbackRequestRef.current = null;
      router.replace("/sign-in");
    },
    refreshAccount,
  }), [account, client, email, suggestedName, refreshAccount, router, status, clearIdentity, resolveLinkOnce]);

  if (!isPublicPath(pathname) && isSupabaseConfigured && status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--mc-background)] px-6 text-sm text-[var(--mc-muted)]">
        Restoring your secure session…
      </div>
    );
  }

  if (!isPublicPath(pathname) && isSupabaseConfigured && status === "unauthenticated") {
    return null;
  }

  if (!isPublicPath(pathname) && authError && !account) {
    return <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--mc-background)] p-6 text-sm text-[var(--mc-text)]"><p>Your care account could not be loaded: {authError}</p><button type="button" onClick={() => void refreshAccount().catch(() => {})} className="rounded-xl bg-[var(--mc-brand)] px-4 py-2 text-white">Try again</button><button type="button" onClick={() => void value.signOut()}>Sign out</button></div>;
  }

  return <AuthContext.Provider value={value}><div key={isPublicPath(pathname) ? "auth-pages" : account?.subject ?? email ?? "signed-out"} className="contents">{children}</div></AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
