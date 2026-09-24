"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  Crown,
  UsersRound,
} from "lucide-react";

const caregivers = [
  {
    initials: "RR",
    name: "Rahul Rao",
    relationship: "Partner",
    role: "Primary caregiver",
    status: "Active",
    color: "bg-[#E8D7E0] text-[#6D3A5B]",
    primary: true,
  },
  {
    initials: "LR",
    name: "Lakshmi Rao",
    relationship: "Mother",
    role: "Family caregiver",
    status: "Active",
    color: "bg-[#E7EEE9] text-[#4F8068]",
    primary: false,
  },
  {
    initials: "PR",
    name: "Priya Rao",
    relationship: "Sister",
    role: "Support caregiver",
    status: "Active",
    color: "bg-[#EEE8E2] text-[#87694A]",
    primary: false,
  },
];

export default function CareCirclePreview() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 }}
      className="rounded-[22px] border border-[#E9E1E4] bg-white p-6 shadow-[0_8px_30px_rgba(33,28,31,0.035)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
            Your Care Circle
          </p>

          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">
            Trusted people in your care
          </h2>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F3EAF0] text-[#6D3A5B]">
          <UsersRound size={17} />
        </div>
      </div>

      {/* Members */}
      <div className="mt-6 space-y-3">
        {caregivers.map((caregiver) => (
          <motion.div
            key={caregiver.name}
            whileHover={{ x: 2 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-between rounded-[14px] border border-[#F0E9EC] px-3 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {/* Avatar */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${caregiver.color}`}
              >
                {caregiver.initials}
              </div>

              {/* Details */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[12px] font-semibold text-[#211C1F]">
                    {caregiver.name}
                  </p>

                  {caregiver.primary && (
                    <Crown
                      size={12}
                      className="shrink-0 text-[#B86B87]"
                      fill="currentColor"
                    />
                  )}
                </div>

                <p className="mt-0.5 text-[10px] text-[#9A9196]">
                  {caregiver.relationship} · {caregiver.role}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="ml-3 flex shrink-0 items-center gap-1.5">
              <CheckCircle2
                size={13}
                className="text-[#4F8068]"
              />

              <span className="hidden text-[10px] font-medium text-[#4F8068] sm:block">
                {caregiver.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Privacy note */}
      <div className="mt-5 rounded-[14px] bg-[#FBF8F7] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#9A9196]">
          Patient-controlled access
        </p>

        <p className="mt-1.5 text-[11px] leading-5 text-[#756D72]">
          Each caregiver only sees the information and responsibilities you
          choose to share.
        </p>
      </div>

      {/* Action */}
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="mt-5 flex w-full items-center justify-between rounded-[12px] border border-[#E9E1E4] bg-white px-4 py-3 text-[12px] font-semibold text-[#6D3A5B] transition-colors hover:bg-[#FBF8F7]"
      >
        <span>Manage Care Circle</span>

        <ArrowUpRight size={15} />
      </motion.button>
    </motion.section>
  );
}