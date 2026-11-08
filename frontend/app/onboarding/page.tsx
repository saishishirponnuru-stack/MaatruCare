"use client";

import { FormEvent, Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthField from "@/components/auth/AuthField";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account, email, suggestedName, refreshAccount } = useAuth();
  const [demoWorkspace, setDemoWorkspace] = useState(false);
  const [phase, setPhase] = useState("");
  const [name, setName] = useState(suggestedName);
  const lock=useRef(false);
  const [role, setRole] = useState<"patient" | "caregiver">(
    searchParams.get("invitation") ? "caregiver" : "patient",
  );
  const [invitationToken, setInvitationToken] = useState(searchParams.get("invitation") ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if(lock.current)return;
    if(!name.trim()){setError("Enter your name.");return;}
    lock.current=true;setBusy(true);
    setError("");
    try {
      await api.bootstrapAccount({ name: name.trim(), role, invitation_token: invitationToken.trim() || undefined, demo_workspace: role === "patient" && demoWorkspace });
      if (role === "patient" && phase) await api.updateProfile({ name: name.trim(), current_phase: phase });
      await refreshAccount();
      router.replace("/dashboard");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to finish account setup.");
    } finally {
      lock.current=false;setBusy(false);
    }
  }

  return (
    <AuthPageShell eyebrow="Finish setup" title="Complete your care profile" description={`Signed in as ${email ?? "your account"}. Choose how this account should be connected.`}>
      <form onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-[12px] border border-[#E7C8CC] bg-[#FFF5F5] p-3 text-xs text-[#9D4B55]">{error}</p>}
        <fieldset disabled={busy} className="space-y-4">
        <AuthField label="Full name" value={name} onChange={setName} autoComplete="name" />
        <fieldset>
          <legend className="text-xs font-semibold text-[var(--mc-text)]">Account type</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(["patient", "caregiver"] as const).map((option) => (
              <label key={option} className={`cursor-pointer rounded-[12px] border p-3 text-xs ${role === option ? "border-[var(--mc-brand)] bg-[var(--mc-brand)]/8" : "border-[var(--mc-border)]"}`}>
                <input type="radio" name="role" value={option} checked={role === option} onChange={() => setRole(option)} className="sr-only" />
                <span className="font-semibold capitalize">{option === "patient" ? "Your care workspace" : "Join a Care Circle"}</span>
                <span className="mt-1 block text-[var(--mc-muted)]">{option === "patient" ? "Create a new care space." : "Join with an approved invitation."}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {role === "patient" && <label className="mc-field">Current journey phase (optional)<select value={phase} onChange={(event) => setPhase(event.target.value)}><option value="">Choose later</option>{["Preconception", "Pregnancy", "Postnatal", "Early motherhood"].map((value) => <option key={value}>{value}</option>)}</select></label>}
        {!account && role === "patient" && process.env.NEXT_PUBLIC_DEMO_CAREGIVERS_ENABLED === "true" && <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-[var(--mc-border)] p-3 text-xs">
          <input type="checkbox" checked={demoWorkspace} onChange={event => setDemoWorkspace(event.target.checked)} className="mt-0.5" />
          <span><span className="block font-semibold">Create a fictional demonstration workspace</span><span className="mt-1 block text-[var(--mc-muted)]">Use made-up information only. Enables simulated caregivers; no sample records are added.</span></span>
        </label>}
        {role === "caregiver" && <AuthField label="Invitation code" value={invitationToken} onChange={setInvitationToken} autoComplete="one-time-code" />}
        <button type="submit" disabled={busy} className="h-11 w-full rounded-[12px] bg-[var(--mc-brand)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60">{busy ? "Saving…" : "Continue to MaatruCare"}</button>
        </fieldset>
      </form>
    </AuthPageShell>
  );
}

export default function OnboardingPage() {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-[var(--mc-muted)]">Loading your care profile...</p>}><OnboardingForm /></Suspense>;
}
