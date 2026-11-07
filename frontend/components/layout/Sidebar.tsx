"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  Sprout,
  UsersRound,
  Clock3,
  CheckSquare,
  ArrowLeftRight,
  ShieldCheck,
  Activity,
  Settings,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import type { RefObject } from "react";

const navigation = [
  { label: "Home", href: "/dashboard", icon: Home, iconTone: "slate" },
  { label: "Journey", href: "/journey", icon: Sprout, iconTone: "rose" },
  { label: "Care Circle", href: "/care-circle", icon: UsersRound, iconTone: "violet" },
  { label: "Timeline", href: "/timeline", icon: Clock3, iconTone: "sky" },
  { label: "Tasks", href: "/tasks", icon: CheckSquare, iconTone: "amber" },
  { label: "Handoffs", href: "/handoffs", icon: ArrowLeftRight, iconTone: "indigo" },
  { label: "Consent", href: "/consent", icon: ShieldCheck, iconTone: "teal" },
  { label: "Lifestyle", href: "/lifestyle", icon: Activity, iconTone: "hydration" },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
  mobileDrawerRef?: RefObject<HTMLElement | null>;
}

export default function Sidebar({
  mobileOpen = false,
  onClose = () => {},
  mobileDrawerRef,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const handleNavigate = () => {
    onClose();
  };

  const sidebarContent = (
    <>
      <div className="flex h-[72px] shrink-0 items-center justify-between px-5 lg:h-[82px] lg:px-7">
        <Link
          href="/dashboard"
          onClick={handleNavigate}
          className="flex min-w-0 items-center"
        >
          <Image
            src="/maatru-care-logo.webp"
            alt="MaatruCare — Care together"
            width={1818}
            height={590}
            priority
            className="mc-brand-logo h-auto w-[184px] max-w-full"
          />
        </Link>

        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-[var(--mc-border)] bg-[var(--mc-surface)] text-[var(--mc-muted)] lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4 lg:py-5">
        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--mc-muted)]">
          Care
        </div>

        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link key={item.href} href={item.href} onClick={handleNavigate} aria-current={active ? "page" : undefined}>
                <motion.div
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.15 }}
                  className={`relative flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--mc-surface-muted)] text-[var(--mc-brand)]"
                      : "text-[var(--mc-muted)] hover:bg-[var(--mc-background)] hover:text-[var(--mc-text)]"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="activeNavigation"
                      className="absolute left-0 h-6 w-[3px] rounded-r-full bg-[#6D3A5B]"
                    />
                  )}

                  <span className={`mc-feature-icon mc-feature-icon--${item.iconTone} flex h-7 w-7 items-center justify-center rounded-[9px]`}><Icon size={16} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" /></span>
                  <span>{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-[var(--mc-border)] px-4 py-4">
        <Link href="/settings" onClick={handleNavigate}>
          <motion.div
            whileHover={{ x: 2 }}
            className={`flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-[var(--mc-surface-muted)] text-[var(--mc-brand)]"
                : "text-[var(--mc-muted)] hover:bg-[var(--mc-background)] hover:text-[var(--mc-text)]"
            }`}
          >
            <span className="mc-feature-icon mc-feature-icon--slate flex h-7 w-7 items-center justify-center rounded-[9px]"><Settings size={16} strokeWidth={1.9} /></span>
            <span>Settings</span>
          </motion.div>
        </Link>

        <div className="mt-3 rounded-[14px] bg-[var(--mc-background)] p-3 lg:mt-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 shrink-0 rounded-full bg-[#9A9196]" />
            <span className="text-[11px] font-medium text-[var(--mc-muted)]">
              Patient-controlled care
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop navigation */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[250px] flex-col border-r border-[var(--mc-border)] bg-[var(--mc-surface)] lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Close navigation overlay"
        aria-hidden={!mobileOpen}
        disabled={!mobileOpen}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#211C1F]/25 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Mobile drawer */}
      <aside
        id="mobile-navigation"
        ref={mobileDrawerRef}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[min(86vw,320px)] flex-col border-r border-[var(--mc-border)] bg-[var(--mc-surface)] shadow-[12px_0_40px_rgba(33,28,31,0.12)] transition-transform duration-250 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
