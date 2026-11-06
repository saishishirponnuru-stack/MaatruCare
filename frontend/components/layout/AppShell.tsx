"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useMaatruCareDemo } from "@/context/MaatruCareDemoContext";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const { loading, error } = useMaatruCareDemo();

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : menuButton;
    document.body.style.overflow = "hidden";
    const drawer = mobileDrawerRef.current;

    function getFocusableItems() {
      return drawer?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [];
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = getFocusableItems();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const focusFrame = window.requestAnimationFrame(() => getFocusableItems()[0]?.focus());
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      window.requestAnimationFrame(() => {
        (returnFocusRef.current ?? menuButton)?.focus();
      });
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--mc-background)] text-[var(--mc-text)] transition-colors duration-200">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        mobileDrawerRef={mobileDrawerRef}
      />

      <Topbar
        onMenu={() => setMobileNavOpen((open) => !open)}
        mobileMenuOpen={mobileNavOpen}
        menuButtonRef={menuButtonRef}
      />

      <main aria-busy={loading} className="ml-0 pt-[72px] lg:ml-[250px] lg:pt-[82px]">
        <div className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:min-h-[calc(100vh-82px)] lg:px-8 lg:py-8 xl:px-10">
          {children}
          {loading && <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-30 rounded-[12px] border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2 text-[11px] font-medium text-[var(--mc-muted)] shadow-sm">Loading coordination data...</div>}
          {error && !loading && <div role="alert" aria-live="assertive" className="fixed bottom-4 right-4 z-30 max-w-[calc(100vw-2rem)] rounded-[12px] border border-[#E7C8CC] bg-[#FFF5F5] px-3 py-2 text-[11px] font-medium text-[#9D4B55] shadow-sm sm:max-w-sm">{error}</div>}
        </div>
      </main>
    </div>
  );
}
