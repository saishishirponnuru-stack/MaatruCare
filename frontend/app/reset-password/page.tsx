"use client";
import Link from "next/link";
import {useEffect,useRef,useState,type FormEvent} from "react";
import AuthField from "@/components/auth/AuthField";
import AuthPageShell from "@/components/auth/AuthPageShell";
import {useAuth} from "@/context/AuthContext";
import {scrubAuthUrl,validatePassword} from "@/lib/auth-flow";

export default function ResetPasswordPage() {
  const {prepareRecovery,updatePassword}=useAuth();
  const [identity,setIdentity]=useState<{subject:string;email:string}|null>(null);
  const [ready,setReady]=useState(false);
  const [password,setPassword]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const handled=useRef(false);const lock=useRef(false);
  useEffect(()=>{
    if(handled.current)return;
    handled.current=true;
    const href=window.location.href;
    window.history.replaceState(window.history.state,"",scrubAuthUrl(href));
    void prepareRecovery(href).then(setIdentity).catch(cause=>setError(cause instanceof Error?cause.message:"Request a fresh recovery link.")).finally(()=>setReady(true));
  },[prepareRecovery]);
  async function submit(event:FormEvent) {
    event.preventDefault();if(lock.current||!identity)return;
    setError("");
    try{validatePassword(password,confirmation);}catch(cause){setError((cause as Error).message);return;}
    lock.current=true;setBusy(true);
    try{await updatePassword(password,confirmation,identity.subject);setPassword("");setConfirmation("");setMessage("Your password has been updated. Sign in using your new password.");}
    catch(cause){setError(cause instanceof Error?cause.message:"Your password could not be updated.");}
    finally{lock.current=false;setBusy(false);}
  }
  return <AuthPageShell eyebrow="Account recovery" title="Choose a new password" description={identity?`Updating the password for ${identity.email}.`:"Open the secure link from your recovery email."}>{!ready?<p role="status" className="text-sm">Checking recovery access...</p>:message?<div className="space-y-4"><p role="status" className="mc-message">{message}</p><Link href="/sign-in" className="mc-button mc-button--primary">Sign in</Link></div>:<>{error&&<p role="alert" className="mc-message mc-message--error">{error}</p>}{identity?<form onSubmit={submit}><fieldset disabled={busy} className="space-y-4"><AuthField label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} maxLength={128}/><AuthField label="Confirm new password" type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" minLength={8} maxLength={128}/><button type="submit" disabled={busy} className="mc-button mc-button--primary w-full">{busy?"Updating...":"Update password"}</button></fieldset></form>:<Link href="/forgot-password" className="mc-button mc-button--primary">Request a new recovery link</Link>}</>}</AuthPageShell>;
}
