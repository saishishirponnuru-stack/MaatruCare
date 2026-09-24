"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

export default function CareStatusCard() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.16 }}
      className="rounded-[22px] border border-[#E9E1E4] bg-white p-6 shadow-[0_8px_30px_rgba(33,28,31,0.035)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
            Care status
          </p>

          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">
            Clinician-documented
          </h2>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#E7EEE9] text-[#4F8068]">
          <FileCheck2 size={17} />
        </div>
      </div>

      {/* Status */}
      <div className="mt-6 rounded-[17px] border border-[#DDE9E1] bg-[#F6FAF7] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E7EEE9] text-[#4F8068]">
            <CheckCircle2 size={16} />
          </div>

          <div>
            <p className="text-[13px] font-semibold text-[#211C1F]">
              Enhanced Observation
            </p>

            <p className="mt-1 text-[10px] leading-4 text-[#756D72]">
              This status was explicitly documented by the care team.
            </p>
          </div>
        </div>
      </div>

      {/* Source */}
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#9A9196]">
            Source
          </span>

          <span className="text-[10px] font-medium text-[#211C1F]">
            Clinic visit · 22 Sep
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#9A9196]">
            Verification
          </span>

          <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#4F8068]">
            <ShieldCheck size={12} />
            Human verified
          </span>
        </div>
      </div>

      {/* Privacy note */}
      <div className="mt-5 rounded-[14px] bg-[#FBF8F7] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#9A9196]">
          Patient control
        </p>

        <p className="mt-1.5 text-[10px] leading-4 text-[#756D72]">
          Sharing is controlled by the patient and limited to authorized
          members of the Care Circle.
        </p>
      </div>

      {/* Action */}
      <motion.button
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        className="mt-5 flex w-full items-center justify-between text-[11px] font-semibold text-[#6D3A5B]"
      >
        <span>View source information</span>

        <ArrowUpRight size={14} />
      </motion.button>
    </motion.section>
  );
}