"use client";

import { Bell, ChevronDown, Globe2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export default function Topbar() {
  const [feedback, setFeedback] = useState("");

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2200);
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-[82px] items-center justify-between border-b border-[#E9E1E4] bg-[#FBF8F7]/95 px-4 backdrop-blur-md lg:left-[250px] lg:px-8">
      {/* Left */}
      <div>
        <p className="text-[12px] font-medium text-[#9A9196]">
          Patient-controlled care
        </p>

        <h1 className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">
          Your care, connected.
        </h1>
        <p className="mt-0.5 text-[9px] font-medium text-[#9A9196]">Synthetic demo · Session data</p>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Language */}
        <motion.button
          type="button"
          onClick={() => showFeedback("Language selection is demo-only in this session.")}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="flex h-10 items-center gap-2 rounded-[11px] border border-[#E9E1E4] bg-white px-3 text-[13px] font-medium text-[#756D72]"
        >
          <Globe2 size={16} />
          English
          <ChevronDown size={14} />
        </motion.button>

        {/* Notifications */}
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

        {/* User */}
        <button type="button" onClick={() => showFeedback("Profile menu is demo-only in this session.")} className="ml-1 flex items-center gap-3 rounded-[12px] border border-transparent px-2 py-1.5 transition-colors hover:border-[#E9E1E4] hover:bg-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8D7E0] text-[13px] font-semibold text-[#6D3A5B]">
            AR
          </div>

          <div className="hidden text-left sm:block">
            <p className="text-[13px] font-semibold text-[#211C1F]">
              Ananya Rao
            </p>
            <p className="text-[10px] text-[#9A9196]">
              Patient
            </p>
          </div>

          <ChevronDown size={15} className="text-[#9A9196]" />
        </button>
      </div>
      {feedback && <div role="status" className="absolute right-4 top-[88px] rounded-[11px] border border-[#E4D7DF] bg-white px-3 py-2 text-[10px] font-medium text-[#6D3A5B] shadow-sm lg:right-8">{feedback}</div>}
    </header>
  );
}