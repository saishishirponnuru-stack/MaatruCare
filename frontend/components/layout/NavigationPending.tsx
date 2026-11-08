"use client";

import {useLinkStatus} from "next/link";

export default function NavigationPending({label}: {label: string}) {
  const {pending}=useLinkStatus();
  return pending ? <span role="status" aria-label={`Opening ${label}`} className="ml-auto text-[10px] font-normal text-[var(--mc-muted)]">Opening…</span> : null;
}
