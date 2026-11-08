"use client";

import BrandLogo from "@/components/ui/BrandLogo";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AuthPageShell({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  const { status } = useAuth();

  return (
    <main className="min-h-screen bg-[var(--mc-background)] px-4 py-8 text-[var(--mc-text)] sm:px-6 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1080px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-[var(--mc-border)] bg-[var(--mc-surface)] shadow-[0_24px_70px_rgba(27,18,37,0.12)] lg:grid-cols-[0.86fr_1.14fr]">
          <div className="hidden bg-[linear-gradient(145deg,#241a34,#4f2c51_60%,#6e3c66)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <BrandLogo onDark />
              <p className="mt-10 max-w-xs text-2xl font-semibold leading-tight tracking-[-0.03em]">Care coordination that keeps responsibility connected.</p>
            </div>
            <p className="max-w-sm text-xs leading-5 text-white/70">MaatruCare is an assistive coordination platform. It does not diagnose conditions, recommend treatment, or make clinical decisions.</p>
          </div>
          <div className="p-6 sm:p-10">
            <Link href="/sign-in" className="flex items-center gap-2 lg:hidden">
              <BrandLogo compact />
            </Link>
            <div className="mt-8 max-w-md lg:mt-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--mc-muted)]">{eyebrow}</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--mc-muted)]">{description}</p>
              {status === "unconfigured" && (
                <p className="mt-5 rounded-[12px] border border-[#E8D5B8] bg-[#FFF9EF] p-3 text-xs leading-5 text-[#8A6435]">
                  Authentication is not configured for this environment. Add the Supabase public settings before using account access.
                </p>
              )}
              <div className="mt-8">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
