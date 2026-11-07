"use client";

import Link from "next/link";
import { FormEvent, Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthField from "@/components/auth/AuthField";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { useAuth } from "@/context/AuthContext";
import GoogleButton from "@/components/auth/GoogleButton";
import ConfirmationHelp from "@/components/auth/ConfirmationHelp";
import {safeAuthNext} from "@/lib/auth-flow";

function SignInForm() {
  const { signIn } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNotice,setShowNotice] = useState(searchParams.get("message") === "verify-email");
  const next=safeAuthNext(searchParams.get("next"));
  const lock=useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if(lock.current)return;
    lock.current=true;setShowNotice(false);
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim(), password, next);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to sign in.");
    } finally {
      lock.current=false;setBusy(false);
    }
  }

  return (
    <AuthPageShell eyebrow="Secure access" title="Sign in to your care workspace" description="Sign in to continue coordinating care with the people you trust.">
      <form onSubmit={submit} className="space-y-4">
        {showNotice && <p role="status" className="mc-message">Registration is awaiting email confirmation. Check your inbox before signing in.</p>}
        {error && <p role="alert" className="rounded-[12px] border border-[#E7C8CC] bg-[#FFF5F5] p-3 text-xs text-[#9D4B55]">{error}</p>}
        <fieldset disabled={busy} className="space-y-4">
        <AuthField label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="flex justify-end"><Link href="/forgot-password" className="text-xs font-semibold text-[var(--mc-brand)] hover:underline">Forgot password?</Link></div>
        <button type="submit" disabled={busy} className="h-11 w-full rounded-[12px] bg-[var(--mc-brand)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
        </fieldset>
      </form>
      <details className="mt-5 text-xs text-[var(--mc-muted)]"><summary className="cursor-pointer py-2 font-semibold">Need a confirmation link?</summary><div className="mt-3"><ConfirmationHelp email={email} nextPath={next}/></div></details>
      <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mc-muted)]">
        <span className="h-px flex-1 bg-[var(--mc-border)]" />
        <span>Or</span>
        <span className="h-px flex-1 bg-[var(--mc-border)]" />
      </div>
      <GoogleButton nextPath={next} disabled={busy}/>
      <p className="mt-3 text-xs leading-5 text-[var(--mc-muted)]">Joined with Google? Continue with Google, or use password recovery to set a password for that account.</p>
      <p className="mt-6 text-center text-xs text-[var(--mc-muted)]">New to MaatruCare? <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="font-semibold text-[var(--mc-brand)] hover:underline">Create an account</Link></p>
    </AuthPageShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
