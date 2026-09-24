"use client";

import { Bell, ChevronDown, Globe2, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

interface TopbarProps {
  onMenu?: () => void;
  mobileMenuOpen?: boolean;
}

export default function Topbar({
  onMenu = () => {},
  mobileMenuOpen = false,
}: TopbarProps) {
  const [feedback, setFeedback] = useState("");

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2200);
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#E9E1E4] bg-[#FBF8F7]/95 px-3 backdrop-blur-md sm:px-4 lg:left-[250px] lg:h-[82px] lg:px-8">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <motion.button
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileMenuOpen}
          onClick={onMenu}
          whileTap={{ scale: 0.96 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-[#E9E1E4] bg-white text-[#6D3A5B] lg:hidden"
        >
          <Menu size={19} />
        </motion.button>

        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-[#9A9196] sm:text-[12px]">
            Patient-controlled care
          </p>

          <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[#211C1F] sm:text-[17px]">
            Your care, connected.
          </h1>

          <p className="truncate text-[8px] font-medium text-[#9A9196] sm:text-[9px]">
            Synthetic demo · Session data
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 lg:gap-3">
        <motion.button
          type="button"
          onClick={() => showFeedback("Language selection is demo-only in this session.")}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          aria-label="Select language"
          className="flex h-10 items-center gap-1.5 rounded-[11px] border border-[#E9E1E4] bg-white px-2.5 text-[12px] font-medium text-[#756D72] sm:gap-2 sm:px-3 sm:text-[13px]"
        >
          <Globe2 size={15} />
          <span className="hidden sm:inline">English</span>
          <span className="sm:hidden">EN</span>
          <ChevronDown size={13} />
        </motion.button>

        <motion.button
          type="button"
          aria-label="View notifications"
          onClick={() => showFeedback("Notifications are demo-only in this session.")}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#E9E1E4] bg-white text-[#756D72]"
        >
          <Bell size={18} />
          <span className="absolute right-[9px] top-[8px] h-2 w-2 rounded-full bg-[#B86B87] ring-2 ring-white" />
        </motion.button>

        <button
          type="button"
          aria-label="Open profile menu"
          onClick={() => showFeedback("Profile menu is demo-only in this session.")}
          className="ml-0.5 flex h-10 items-center gap-1.5 rounded-[12px] px-1.5 py-1.5 transition-colors hover:bg-white sm:ml-1 sm:gap-2 sm:px-2 lg:gap-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8D7E0] text-[12px] font-semibold text-[#6D3A5B] sm:text-[13px]">
            AR
          </div>

          <div className="hidden text-left lg:block">
            <p className="text-[13px] font-semibold text-[#211C1F]">Ananya Rao</p>
            <p className="text-[10px] text-[#9A9196]">Patient</p>
          </div>

          <ChevronDown size={14} className="text-[#9A9196]" />
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className="absolute right-3 top-[78px] max-w-[calc(100vw-24px)] rounded-[11px] border border-[#E4D7DF] bg-white px-3 py-2 text-[10px] font-medium text-[#6D3A5B] shadow-sm sm:right-4 sm:top-[88px] lg:right-8"
        >
          {feedback}
        </div>
      )}
    </header>
  );
}
