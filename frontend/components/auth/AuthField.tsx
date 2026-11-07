"use client";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function AuthField({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required = true,
  placeholder,
  minLength,
  maxLength,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="block">
      <label htmlFor={id} className="text-xs font-semibold text-[var(--mc-text)]">{label}</label>
      <div className="relative">
      <input
        id={id}
        type={isPassword && visible ? "text" : type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        minLength={minLength}
        maxLength={maxLength}
        className={`mt-2 h-11 w-full rounded-[12px] border border-[var(--mc-border)] bg-[var(--mc-surface-muted)] px-3 text-sm text-[var(--mc-text)] outline-none transition placeholder:text-[var(--mc-muted)] focus:border-[var(--mc-brand)] focus:ring-2 focus:ring-[var(--mc-brand)]/15 ${isPassword ? "pr-12" : ""}`}
      />
      {isPassword && <button type="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={id} onClick={() => setVisible(!visible)} className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-r-xl text-[var(--mc-muted)] focus-visible:outline-2 focus-visible:outline-[var(--mc-brand)]">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
      </div>
    </div>
  );
}
