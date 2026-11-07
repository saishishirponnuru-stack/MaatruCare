"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import AuthField from "@/components/auth/AuthField";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { useAuth } from "@/context/AuthContext";

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const lock=useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if(lock.current)return;
    lock.current=true;setBusy(true);
    setError("");
    setMessage("");
    try {
      await sendPasswordReset(email.trim());
      setMessage("If this email is eligible, a recovery email has been requested. Check your inbox and spam folder; delivery is not confirmed here.");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to send the reset email.");
    } finally {
      lock.current=false;setBusy(false);
    }
  }

  return (
    <AuthPageShell eyebrow="Account recovery" title="Reset your password" description="We’ll send a secure recovery link to your account email.">
      <form onSubmit={submit} className="space-y-4">
        {message && <p role="status" className="rounded-[12px] border border-[#CFE0D5] bg-[#F1F8F3] p-3 text-xs text-[#3F6D56]">{message}</p>}
        {error && <p role="alert" className="rounded-[12px] border border-[#E7C8CC] bg-[#FFF5F5] p-3 text-xs text-[#9D4B55]">{error}</p>}
        <fieldset disabled={busy} className="space-y-4">
        <AuthField label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <button type="submit" disabled={busy} className="h-11 w-full rounded-[12px] bg-[var(--mc-brand)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60">{busy ? "Sending…" : "Send reset link"}</button>
        </fieldset>
      </form>
      <p className="mt-6 text-center text-xs text-[var(--mc-muted)]"><Link href="/sign-in" className="font-semibold text-[var(--mc-brand)] hover:underline">Return to sign in</Link></p>
    </AuthPageShell>
  );
}
