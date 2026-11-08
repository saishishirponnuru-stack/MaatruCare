"use client";

import {usePathname} from "next/navigation";
import {useAuth} from "@/context/AuthContext";
import AppShell from "@/components/layout/AppShell";

export default function Loading() {
  const pathname=usePathname();const {account}=useAuth();
  const title:Record<string,string>={"/dashboard":"Home","/care-circle":"Care Circle","/lifestyle":"Lifestyle","/tasks":"Tasks","/handoffs":"Handoffs","/ai-assist":"AI Assist","/consent":"Consent","/timeline":"Timeline","/settings":"Settings","/profile":"Profile","/journey":"Journey"};
  const content=<p role="status" aria-label={`Opening ${title[pathname] ?? "page"}`} className="mc-caption py-8">Opening {title[pathname] ?? "your care workspace"}…</p>;
  // The shared boundary also wraps public/onboarding routes, which intentionally
  // have no coordination provider. It never renders private data by itself.
  return account && pathname!=="/onboarding" && !["/sign-in","/sign-up","/auth/callback","/forgot-password","/reset-password"].includes(pathname)
    ? <AppShell busy>{content}</AppShell>
    : <div className="min-h-screen bg-[var(--mc-background)] p-6 text-[var(--mc-text)]">{content}</div>;
}
