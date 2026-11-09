"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ConfirmationHelp({email,nextPath}: {email:string;nextPath?:string}) {
  const {resendVerification} = useAuth();
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [remaining,setRemaining] = useState(0);
  const cooldown = remaining > 0;
  const lock = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);
  async function resend() {
    if(lock.current || cooldown)return;
    lock.current=true;setBusy(true);setError("");setMessage("");
    try {
      await resendVerification(email,nextPath);
      setMessage("If this registration is eligible, a confirmation email has been requested. Check your inbox and spam folder.");
      setRemaining(60);
    } catch(cause) {setError(cause instanceof Error?cause.message:"The confirmation request could not be completed.");}
    finally {lock.current=false;setBusy(false);}
  }
  return <div className="space-y-3 text-xs leading-5 text-[var(--mc-muted)]"><p>Confirm your email using the link in your inbox. Open the link in the browser where you registered, then continue to your care workspace.</p><p>If no message arrives, check spam or request another link. Email delivery depends on this environment&apos;s email service.</p><button type="button" disabled={busy||cooldown} onClick={()=>void resend()} className="min-h-10 rounded-xl border border-[var(--mc-border)] px-3 font-semibold text-[var(--mc-brand)] disabled:opacity-60">{busy?"Requesting...":cooldown?`Try again in ${remaining}s`:"Resend confirmation email"}</button>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="mc-message mc-message--error">{error}</p>}</div>;
}
