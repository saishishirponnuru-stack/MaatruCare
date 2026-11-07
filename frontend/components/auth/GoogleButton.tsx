"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
      <path fill="#34A853" d="M12 21.67c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.67Z" />
      <path fill="#FBBC05" d="M6.54 13.75a5.85 5.85 0 0 1 0-3.5V7.72H3.3a9.75 9.75 0 0 0 0 8.56l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 6.22c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.3 14.63 2.33 12 2.33a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.94 9.46 6.22 12 6.22Z" />
    </svg>
  );
}

export default function GoogleButton({ nextPath, disabled = false }: { nextPath?: string; disabled?: boolean }) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lock=useRef(false);

  async function continueWithGoogle() {
    if(lock.current||disabled)return;
    lock.current=true;setBusy(true);
    setError("");
    try {
      await signInWithGoogle(nextPath);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Google sign-in is unavailable.",
      );
      lock.current=false;setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void continueWithGoogle()}
        disabled={busy||disabled}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-[12px] border border-[var(--mc-border)] bg-[var(--mc-surface)] px-4 text-sm font-semibold text-[var(--mc-text)] transition hover:bg-[var(--mc-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--mc-brand)]/20 disabled:cursor-wait disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? "Connecting to Google…" : "Continue with Google"}
      </button>
      {error && (
        <p role="alert" className="mt-3 rounded-[12px] border border-[#E7C8CC] bg-[#FFF5F5] p-3 text-xs leading-5 text-[#9D4B55]">
          {error}
        </p>
      )}
    </div>
  );
}
