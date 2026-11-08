"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, UserRound, X } from "lucide-react";
import { motion } from "framer-motion";
import type { RefObject } from "react";
import { usePreferences } from "@/context/PreferencesContext";
import { useAuth } from "@/context/AuthContext";
import SignOutButton from "@/components/auth/SignOutButton";

interface TopbarProps {
  onMenu?: () => void;
  mobileMenuOpen?: boolean;
  menuButtonRef?: RefObject<HTMLButtonElement | null>;
}

const pageTitles: Array<[string, string]> = [
  ["/dashboard", "Home"],
  ["/journey", "Journey"],
  ["/care-circle", "Care Circle"],
  ["/timeline", "Timeline"],
  ["/tasks", "Tasks"],
  ["/handoffs", "Handoffs"],
  ["/consent", "Consent"],
  ["/appointments", "Appointments"],
  ["/ai-assist", "AI Assist"],
  ["/profile", "Profile"],
  ["/lifestyle", "Lifestyle"],
  ["/settings", "Settings"],
];

export default function Topbar({
  onMenu = () => {},
  mobileMenuOpen = false,
  menuButtonRef,
}: TopbarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme, reducedMotion } = usePreferences();
  const { account } = useAuth();
  const title = pageTitles.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? "Care coordination";

  return (
    <header className="glass-surface fixed left-0 right-0 top-0 z-30 flex h-[72px] items-center justify-between border-b border-[var(--mc-border)] bg-[var(--mc-background)] px-3 backdrop-blur-md sm:px-4 lg:left-[250px] lg:h-[82px] lg:px-8">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <motion.button
          ref={menuButtonRef}
          type="button"
          aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          aria-haspopup="dialog"
          onClick={onMenu}
          whileTap={reducedMotion ? undefined : { scale: 0.96 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-[var(--mc-border)] bg-[var(--mc-surface)] text-[var(--mc-brand)] lg:hidden"
        >
          {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
        </motion.button>

        <Link href="/dashboard" prefetch={false} aria-label="MaatruCare home" className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <Image
            src="/maatru-care-mark.webp"
            alt=""
            aria-hidden="true"
            width={512}
            height={512}
            priority
            className="mc-brand-mark h-9 w-9 shrink-0 object-contain"
          />
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-semibold tracking-[0.01em] text-[var(--mc-text)]">MaatruCare</span>
            <span className="block truncate text-[11px] font-medium text-[var(--mc-muted)]">{title}</span>
          </span>
        </Link>

        <div className="hidden min-w-0 lg:block">

          <p className="truncate text-[16px] font-semibold tracking-[-0.02em] text-[var(--mc-text)]">{title}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <motion.button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={theme === "dark"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          whileHover={reducedMotion ? undefined : { y: -1 }}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-[var(--mc-border)] bg-[var(--mc-surface)] text-[var(--mc-brand)]"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </motion.button>
        <Link href="/profile" prefetch={false} aria-label="View care profile" title="View care profile" className="hidden h-10 items-center gap-2 rounded-[11px] border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 text-xs font-semibold text-[var(--mc-brand)] transition hover:bg-[var(--mc-surface-muted)] lg:flex">
          <UserRound size={16} />
          <span className="max-w-36 truncate">{account?.name ?? "Care profile"}</span>
        </Link>
        <SignOutButton className="hidden h-10 rounded-[11px] border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 text-xs font-semibold text-[var(--mc-muted)] transition hover:bg-[var(--mc-surface-muted)] lg:block" />
      </div>
    </header>
  );
}
