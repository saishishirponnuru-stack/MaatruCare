"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  FileCheck2,
  UserPlus,
  ShieldCheck,
} from "lucide-react";

const activities = [
  {
    icon: ShieldCheck,
    title: "Consent updated",
    description: "Rahul can view approved care updates.",
    time: "18 min ago",
    color: "bg-[#F3EAF0] text-[#6D3A5B]",
  },
  {
    icon: CheckCircle2,
    title: "Task assigned",
    description: "Transport coordination assigned to Lakshmi.",
    time: "42 min ago",
    color: "bg-[#E7EEE9] text-[#4F8068]",
  },
  {
    icon: FileCheck2,
    title: "Care information verified",
    description: "Clinician-documented information was reviewed.",
    time: "1 hr ago",
    color: "bg-[#EEE8E2] text-[#87694A]",
  },
  {
    icon: UserPlus,
    title: "Caregiver active",
    description: "Priya joined the Care Circle.",
    time: "Yesterday",
    color: "bg-[#F3EAF0] text-[#6D3A5B]",
  },
];

export default function RecentActivity() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-[22px] border border-[#E9E1E4] bg-white p-6 shadow-[0_8px_30px_rgba(33,28,31,0.035)]"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
          Activity
        </p>

        <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">
          Recent coordination
        </h2>
      </div>

      <div className="mt-6 space-y-5">
        {activities.map((activity, index) => {
          const Icon = activity.icon;

          return (
            <motion.div
              key={activity.title}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.3,
                delay: 0.2 + index * 0.06,
              }}
              className="flex gap-3"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${activity.color}`}
              >
                <Icon size={15} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] font-semibold text-[#211C1F]">
                    {activity.title}
                  </p>

                  <span className="shrink-0 text-[9px] text-[#9A9196]">
                    {activity.time}
                  </span>
                </div>

                <p className="mt-1 text-[10px] leading-4 text-[#756D72]">
                  {activity.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-[#F0E9EC] pt-4">
        <p className="text-[10px] leading-4 text-[#9A9196]">
          Your activity history helps you understand what changed and who
          interacted with your care space.
        </p>
      </div>
    </motion.section>
  );
}