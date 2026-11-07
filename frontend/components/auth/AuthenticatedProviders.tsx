"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { MaatruCareDemoProvider } from "@/context/MaatruCareDemoContext";
import { useAuth } from "@/context/AuthContext";

export default function AuthenticatedProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, account } = useAuth();
  const publicPath = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth/callback"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  useEffect(() => {
    if (!publicPath && status === "authenticated" && !account && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [account, pathname, publicPath, router, status]);

  if (publicPath || pathname === "/onboarding") {
    return <>{children}</>;
  }
  if (status === "unconfigured") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--mc-background)] px-6 text-center">
        <div className="max-w-md rounded-[20px] border border-[var(--mc-border)] bg-[var(--mc-surface)] p-8 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--mc-muted)]">Account access</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--mc-text)]">Authentication needs configuration</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--mc-muted)]">Add the Supabase public settings to this environment before opening the protected care workspace.</p>
          <Link href="/sign-in" className="mt-6 inline-flex h-10 items-center rounded-[11px] bg-[var(--mc-brand)] px-4 text-xs font-semibold text-white">Open account access</Link>
        </div>
      </div>
    );
  }
  if (status !== "authenticated" || !account) {
    return null;
  }
  return <MaatruCareDemoProvider>{children}</MaatruCareDemoProvider>;
}
