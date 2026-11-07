"use client";
import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuth();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function leave() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await signOut(); }
    catch { setError("Sign out failed. Check your connection and try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={() => void leave()} className={className}>{busy ? "Signing out..." : "Sign out"}</button>{error && <p role="alert" className="mc-caption max-w-52 text-[var(--mc-danger)]">{error}</p>}</div>;
}
