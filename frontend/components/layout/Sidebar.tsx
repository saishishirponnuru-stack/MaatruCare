"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Sprout,
  UsersRound,
  Clock3,
  CheckSquare,
  ArrowLeftRight,
  ShieldCheck,
  Settings,
  HeartPulse,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

const navigation = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Journey", href: "/journey", icon: Sprout },
  { label: "Care Circle", href: "/care-circle", icon: UsersRound },
  { label: "Timeline", href: "/timeline", icon: Clock3 },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Handoffs", href: "/handoffs", icon: ArrowLeftRight },
  { label: "Consent", href: "/consent", icon: ShieldCheck },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  mobileOpen = false,
  onClose = () => {},
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
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#6D3A5B] text-white shadow-sm">
            <HeartPulse size={21} strokeWidth={2.2} />
          </div>

          <div>
            <div className="text-[18px] font-semibold tracking-[-0.02em] text-[#211C1F]">
              MaatruCare
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#756D72]">
              Care together
            </div>
          </div>
        </Link>

        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#E9E1E4] bg-white text-[#756D72] lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4 lg:py-5">
        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9A9196]">
          Care
        </div>

        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link key={item.href} href={item.href} onClick={handleNavigate}>
                <motion.div
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.15 }}
                  className={`relative flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium transition-colors ${
                    active
                      ? "bg-[#F3EAF0] text-[#6D3A5B]"
                      : "text-[#756D72] hover:bg-[#FBF8F7] hover:text-[#211C1F]"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="activeNavigation"
                      className="absolute left-0 h-6 w-[3px] rounded-r-full bg-[#6D3A5B]"
                    />
                  )}

                  <Icon size={18} strokeWidth={active ? 2.3 : 1.9} />
                  <span>{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-[#E9E1E4] px-4 py-4">
        <Link href="/settings" onClick={handleNavigate}>
          <motion.div
            whileHover={{ x: 2 }}
            className={`flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-[#F3EAF0] text-[#6D3A5B]"
                : "text-[#756D72] hover:bg-[#FBF8F7] hover:text-[#211C1F]"
            }`}
          >
            <Settings size={18} strokeWidth={1.9} />
            <span>Settings</span>
          </motion.div>
        </Link>

        <div className="mt-3 rounded-[14px] bg-[#FBF8F7] p-3 lg:mt-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 shrink-0 rounded-full bg-[#4F8068]" />
            <span className="text-[11px] font-medium text-[#756D72]">
              Your care space is private
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop navigation */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[250px] flex-col border-r border-[#E9E1E4] bg-white lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Close navigation overlay"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#211C1F]/25 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Mobile drawer */}
      <aside
        aria-label="Mobile navigation"
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[min(86vw,320px)] flex-col border-r border-[#E9E1E4] bg-white shadow-[12px_0_40px_rgba(33,28,31,0.12)] transition-transform duration-250 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
