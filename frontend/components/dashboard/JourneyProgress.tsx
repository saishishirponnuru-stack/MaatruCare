"use client";

import { motion } from "framer-motion";
import { Check, Sprout } from "lucide-react";

const phases = [
  {
    label: "Preconception",
    shortLabel: "Preconception",
    completed: true,
  },
  {
    label: "Pregnancy",
    shortLabel: "Pregnancy",
    current: true,
  },
  {
    label: "Postnatal",
    shortLabel: "Postnatal",
  },
  {
    label: "Early motherhood",
    shortLabel: "Early motherhood",
  },
];

export default function JourneyProgress() {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#E9E1E4] bg-white shadow-[0_8px_30px_rgba(33,28,31,0.035)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#F0E9EC] px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
            Your journey
          </p>

          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">
            Complete motherhood support
          </h2>
        </div>

        <div className="hidden items-center gap-2 rounded-full bg-[#FBF8F7] px-3 py-1.5 sm:flex">
          <Sprout size={14} className="text-[#6D3A5B]" />

          <span className="text-[11px] font-medium text-[#756D72]">
            Pregnancy · Current phase
          </span>
        </div>
      </div>

      {/* Journey */}
      <div className="px-6 pb-7 pt-8">
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-[7%] right-[7%] top-[18px] h-px bg-[#E9E1E4]" />

          {/* Completed progress line */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "35%" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute left-[7%] top-[18px] h-px bg-[#6D3A5B]"
          />

          <div className="relative grid grid-cols-4 gap-3">
            {phases.map((phase, index) => {
              const isCompleted = phase.completed;
              const isCurrent = phase.current;

              return (
                <motion.div
                  key={phase.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.08,
                  }}
                  className="flex flex-col items-center text-center"
                >
                  {/* Phase marker */}
                  <div
                    className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-[3px] bg-white ${
                      isCurrent
                        ? "border-[#6D3A5B] shadow-[0_0_0_5px_rgba(109,58,91,0.08)]"
                        : isCompleted
                          ? "border-[#6D3A5B] bg-[#6D3A5B]"
                          : "border-[#E9E1E4]"
                    }`}
                  >
                    {isCompleted ? (
                      <Check
                        size={15}
                        strokeWidth={2.8}
                        className="text-white"
                      />
                    ) : isCurrent ? (
                      <div className="h-2.5 w-2.5 rounded-full bg-[#6D3A5B]" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-[#D5CDD1]" />
                    )}
                  </div>

                  {/* Label */}
                  <p
                    className={`mt-3 text-[12px] font-semibold ${
                      isCurrent
                        ? "text-[#6D3A5B]"
                        : isCompleted
                          ? "text-[#211C1F]"
                          : "text-[#9A9196]"
                    }`}
                  >
                    {phase.shortLabel}
                  </p>

                  {/* State */}
                  <p className="mt-1 text-[10px] text-[#9A9196]">
                    {isCurrent
                      ? "Current phase"
                      : isCompleted
                        ? "Completed"
                        : "Upcoming"}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Current phase information */}
        <div className="mt-7 flex items-center justify-between rounded-[15px] bg-[#FBF8F7] px-4 py-3.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">
              Current phase
            </p>

            <p className="mt-1 text-[13px] font-semibold text-[#211C1F]">
              Pregnancy
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">
              Care Circle
            </p>

            <p className="mt-1 text-[13px] font-semibold text-[#6D3A5B]">
              3 trusted caregivers
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}