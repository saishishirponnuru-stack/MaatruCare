"use client";
import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ConfirmationHelp({email,nextPath}: {email:string;nextPath?:string}) {
  const {resendVerification} = useAuth();
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [cooldown,setCooldown] = useState(false);
  const lock = useRef(false);
  async function resend() {
    if(lock.current || cooldown)return;
    lock.current=true;setBusy(true);setError("");setMessage("");
    try {
      await resendVerification(email,nextPath);
      setMessage("If this registration is eligible, a confirmation email has been requested. Check your inbox and spam folder.");
      setCooldown(true);window.setTimeout(()=>setCooldown(false),60000);
    } catch(cause) {setError(cause instanceof Error?cause.message:"The confirmation request could not be completed.");}
    finally {lock.current=false;setBusy(false);}
  }
  return <div className="space-y-3 text-xs leading-5 text-[var(--mc-muted)]"><p>Confirm your email using the link in your inbox. Open the link in the browser where you registered, then continue to your care workspace.</p><p>If no message arrives, check spam or request another link. Email delivery depends on this environment&apos;s email service.</p><button type="button" disabled={busy||cooldown} onClick={()=>void resend()} className="min-h-10 rounded-xl border border-[var(--mc-border)] px-3 font-semibold text-[var(--mc-brand)] disabled:opacity-60">{busy?"Requesting...":cooldown?"Wait before requesting again":"Resend confirmation email"}</button>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="mc-message mc-message--error">{error}</p>}</div>;
}
