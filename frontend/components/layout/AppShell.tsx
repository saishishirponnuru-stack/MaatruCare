"use client";

import { ReactNode, useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FBF8F7]">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      <Topbar
        onMenu={() => setMobileNavOpen((open) => !open)}
        mobileMenuOpen={mobileNavOpen}
      />

      <main className="ml-0 pt-[72px] lg:ml-[250px] lg:pt-[82px]">
        <div className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:min-h-[calc(100vh-82px)] lg:px-8 lg:py-8 xl:px-10">
          {children}
        </div>
      </main>
    </div>
  );
}
