"use client";

import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#FBF8F7]">
      <Sidebar />

      <Topbar />

      <main className="ml-0 pt-[82px] lg:ml-[250px]">
        <div className="mx-auto min-h-[calc(100vh-82px)] max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}