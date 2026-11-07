"use client";

import { cloneElement, isValidElement, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";

export function Button({ variant = "primary", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return <button type="button" {...props} className={`mc-button mc-button--${variant} ${className}`}>{children}</button>;
}

export function Panel({ title, description, action, children, className = "" }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`mc-panel ${className}`}><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{title}</h2>{description && <p className="mc-caption mt-1 max-w-2xl">{description}</p>}</div>{action}</div>{children}</section>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId();
  const control = isValidElement<{ id?: string; "aria-describedby"?: string }>(children)
    ? cloneElement(children, { id, "aria-describedby": hint ? `${id}-hint` : undefined })
    : children;
  return <div className="mc-field"><label htmlFor={id}>{label}</label>{control}{hint && <span id={`${id}-hint`} className="mc-caption font-normal">{hint}</span>}</div>;
}

export function Message({ children, error = false }: { children: ReactNode; error?: boolean }) {
  if (!children) return null;
  return <div role={error ? "alert" : "status"} className={`mc-message ${error ? "mc-message--error" : ""}`}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <span className={`mc-badge mc-badge--${tone}`}>{children}</span>;
}

export function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return <div className="mc-stat"><p className="mc-caption">{label}</p><p className="mt-1 break-words text-2xl font-semibold tabular-nums">{value}</p>{detail && <p className="mc-caption mt-1">{detail}</p>}</div>;
}

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const headingId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={headingId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="mc-drawer"><div className="flex h-full flex-col" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between gap-4 border-b border-[var(--mc-border)] p-6"><h2 id={headingId} className="text-xl font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="Close panel" className="mc-icon-button"><X size={19} /></button></header><div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div></div></dialog>;
}

export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-[var(--mc-muted)]">{description}</p></div>{action}</header>;
}
