"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import AuthPageShell from "@/components/auth/AuthPageShell";
import {useAuth} from "@/context/AuthContext";
import {scrubAuthUrl} from "@/lib/auth-flow";

export default function AuthCallbackPage() {
  const {completeAuthCallback}=useAuth();
  const [error,setError]=useState("");
  const handled=useRef(false);
  useEffect(()=>{
    if(handled.current)return;
    handled.current=true;
    const href=window.location.href;
    window.history.replaceState(window.history.state,"",scrubAuthUrl(href));
    void completeAuthCallback(href).catch(cause=>setError(cause instanceof Error?cause.message:"Account access could not be completed."));
  },[completeAuthCallback]);
  return <AuthPageShell eyebrow="Secure access" title={error?"This link could not be completed":"Confirming your account access"} description={error?"Request a new link or sign in if your email is already confirmed.":"Checking your confirmation, recovery or Google sign-in link."}>{error?<div className="space-y-4"><p role="alert" className="mc-message mc-message--error">{error}</p><Link href="/sign-in" className="mc-button mc-button--primary">Return to sign in</Link><Link href="/forgot-password" className="ml-3 text-xs underline">Request password recovery</Link></div>:<p role="status" className="text-sm text-[var(--mc-muted)]">Verifying your secure link...</p>}</AuthPageShell>;
}
