"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  UserRound,
} from "lucide-react";

export default function NextAppointment() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[22px] border border-[#E9E1E4] bg-white p-6 shadow-[0_8px_30px_rgba(33,28,31,0.035)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
            Next appointment
          </p>

          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">
            Maternal care visit
          </h2>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F3EAF0] text-[#6D3A5B]">
          <CalendarDays size={17} />
        </div>
      </div>

      {/* Date */}
      <div className="mt-6 flex items-center gap-4">
        <div className="flex h-[66px] w-[66px] flex-col items-center justify-center rounded-[16px] bg-[#6D3A5B] text-white">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] opacity-80">
            Sep
          </span>

          <span className="mt-0.5 text-[25px] font-semibold leading-none">
            28
          </span>
        </div>

        <div>
          <p className="text-[14px] font-semibold text-[#211C1F]">
            Monday, 28 September
          </p>

          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-[#756D72]">
            <Clock3 size={13} />
            <span>10:30 AM</span>
          </div>
        </div>
      </div>

      {/* Clinician */}
      <div className="mt-6 flex items-center gap-3 border-t border-[#F0E9EC] pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8D7E0] text-[#6D3A5B]">
          <UserRound size={16} />
        </div>

        <div>
          <p className="text-[12px] font-semibold text-[#211C1F]">
            Dr. Meera Sharma
          </p>

          <p className="mt-0.5 text-[10px] text-[#9A9196]">
            Maternal care · City Women&apos;s Clinic
          </p>
        </div>
      </div>

      {/* Location */}
      <div className="mt-4 flex items-center gap-2 text-[11px] text-[#756D72]">
        <MapPin size={13} className="text-[#9A9196]" />
        <span>City Women&apos;s Clinic</span>
      </div>

      {/* Coordination */}
      <div className="mt-5 rounded-[14px] bg-[#FBF8F7] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9196]">
            Coordination
          </span>

          <span className="rounded-full bg-[#E8F0EB] px-2.5 py-1 text-[9px] font-semibold text-[#4F8068]">
            Confirmed
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-[#211C1F]">
              Transport
            </p>

            <p className="text-[10px] text-[#9A9196]">
              Rahul · Primary caregiver
            </p>
          </div>

          <span className="text-[10px] font-medium text-[#4F8068]">
            Assigned
          </span>
        </div>
      </div>

      {/* Action */}
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="mt-5 flex w-full items-center justify-between rounded-[12px] bg-[#6D3A5B] px-4 py-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#4D2941]"
      >
        <span>View appointment</span>

        <ArrowUpRight size={15} />
      </motion.button>
    </motion.section>
  );
}