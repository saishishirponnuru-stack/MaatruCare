"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useRef, useState } from "react";
import AuthField from "@/components/auth/AuthField";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { useAuth } from "@/context/AuthContext";
import GoogleButton from "@/components/auth/GoogleButton";
import ConfirmationHelp from "@/components/auth/ConfirmationHelp";
import {safeAuthNext, validatePassword} from "@/lib/auth-flow";

function SignUpForm() {
  const params = useSearchParams();
  const next = safeAuthNext(params.get("next"));
  const invitation = next.startsWith("/onboarding?") ? new URLSearchParams(next.split("?")[1]).get("invitation") ?? "" : "";
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"patient" | "caregiver">(invitation ? "caregiver" : "patient");
  const [invitationToken, setInvitationToken] = useState(invitation);
  const [confirmation,setConfirmation] = useState("");
  const [pendingNext,setPendingNext] = useState<string|null>(null);
  const lock=useRef(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if(lock.current)return;
    setError("");
    try {validatePassword(password,confirmation);} catch(cause) {setError((cause as Error).message);return;}
    lock.current=true;setBusy(true);
    try {
      const result = await signUp(email.trim(), password, confirmation, name.trim(), role, invitationToken.trim() || undefined);
      if(result.confirmationRequired){setPassword("");setConfirmation("");setPendingNext(result.next);}
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to create your account.");
    } finally {
      lock.current=false;setBusy(false);
    }
  }

  return (
    <AuthPageShell eyebrow="Create your account" title="Set up your care space" description="Set up your care workspace or join a Care Circle invitation.">
      {pendingNext ? <div className="space-y-5"><h2 className="text-xl font-semibold">Check your inbox to confirm your email</h2><p role="status" className="text-sm text-[var(--mc-muted)]">Registration is awaiting confirmation. If this address is eligible, Supabase has accepted the confirmation request.</p><ConfirmationHelp email={email} nextPath={pendingNext}/><Link href={`/sign-in?next=${encodeURIComponent(pendingNext)}`} className="mc-button mc-button--primary">Continue to sign in</Link><button type="button" className="block text-xs underline" onClick={()=>{setPendingNext(null);setError("");}}>Use a different email</button></div> : <><form onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-[12px] border border-[#E7C8CC] bg-[#FFF5F5] p-3 text-xs text-[#9D4B55]">{error}</p>}
        <fieldset disabled={busy} className="space-y-4">
        <AuthField label="Full name" value={name} onChange={setName} autoComplete="name" />
        <AuthField label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthField label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" minLength={8} maxLength={128} />
        <AuthField label="Confirm password" type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" minLength={8} maxLength={128} />
        <fieldset>
          <legend className="text-xs font-semibold text-[var(--mc-text)]">Account type</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(["patient", "caregiver"] as const).map((option) => (
              <label key={option} className={`cursor-pointer rounded-[12px] border p-3 text-xs ${role === option ? "border-[var(--mc-brand)] bg-[var(--mc-brand)]/8" : "border-[var(--mc-border)]"}`}>
                <input type="radio" name="role" value={option} checked={role === option} onChange={() => setRole(option)} className="sr-only" />
                <span className="font-semibold capitalize">{option === "patient" ? "Your care workspace" : "Join a Care Circle"}</span>
                <span className="mt-1 block text-[var(--mc-muted)]">{option === "patient" ? "Create and control your care space." : "Join with an approved invitation."}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {role === "caregiver" && <AuthField label="Invitation code" value={invitationToken} onChange={setInvitationToken} autoComplete="one-time-code" placeholder="Shared by the Care Circle owner" />}
        <button type="submit" disabled={busy} className="h-11 w-full rounded-[12px] bg-[var(--mc-brand)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60">{busy ? "Creating account…" : "Create account"}</button>
        </fieldset>
      </form>
      <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mc-muted)]">
        <span className="h-px flex-1 bg-[var(--mc-border)]" />
        <span>Or</span>
        <span className="h-px flex-1 bg-[var(--mc-border)]" />
      </div>
      <GoogleButton nextPath={next} disabled={busy}/>
      <p className="mt-6 text-center text-xs text-[var(--mc-muted)]">Already have an account? <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-semibold text-[var(--mc-brand)] hover:underline">Sign in</Link></p></>}
    </AuthPageShell>
  );
}

export default function SignUpPage() { return <Suspense fallback={null}><SignUpForm /></Suspense>; }
