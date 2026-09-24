"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarCheck2,
  Circle,
  FileText,
  Car,
} from "lucide-react";

const tasks = [
  {
    id: 1,
    title: "Prepare appointment documents",
    description: "Keep approved documents ready for the upcoming visit.",
    owner: "Rahul",
    ownerInitials: "RR",
    icon: FileText,
    status: "Pending",
  },
  {
    id: 2,
    title: "Confirm transport",
    description: "Confirm transport for the 28 September appointment.",
    owner: "Lakshmi",
    ownerInitials: "LR",
    icon: Car,
    status: "In progress",
  },
  {
    id: 3,
    title: "Review appointment details",
    description: "Check time, location and shared appointment information.",
    owner: "Ananya",
    ownerInitials: "AR",
    icon: CalendarCheck2,
    status: "Pending",
  },
];

export default function CoordinationTasks() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 }}
      className="rounded-[22px] border border-[#E9E1E4] bg-white shadow-[0_8px_30px_rgba(33,28,31,0.035)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#F0E9EC] px-6 py-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9196]">
            Coordination
          </p>

          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#211C1F]">
            Today&apos;s responsibilities
          </h2>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-[#F3EAF0] px-3 py-1.5">
          <span className="text-[11px] font-semibold text-[#6D3A5B]">
            3 open
          </span>
        </div>
      </div>

      {/* Tasks */}
      <div className="divide-y divide-[#F0E9EC]">
        {tasks.map((task, index) => {
          const Icon = task.icon;

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.15 + index * 0.06 }}
              className="group flex items-center gap-4 px-6 py-4"
            >
              {/* Checkbox */}
              <button
                aria-label={`Mark ${task.title} complete`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#DCD3D7] bg-white text-[#9A9196] transition-all hover:border-[#6D3A5B] hover:text-[#6D3A5B]"
              >
                <Circle size={15} strokeWidth={1.7} />
              </button>

              {/* Icon */}
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#FBF8F7] text-[#6D3A5B] sm:flex">
                <Icon size={16} />
              </div>

              {/* Task */}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-[#211C1F]">
                  {task.title}
                </p>

                <p className="mt-1 truncate text-[10px] text-[#9A9196]">
                  {task.description}
                </p>
              </div>

              {/* Owner */}
              <div className="hidden items-center gap-2 md:flex">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8D7E0] text-[9px] font-bold text-[#6D3A5B]">
                  {task.ownerInitials}
                </div>

                <div>
                  <p className="text-[10px] font-medium text-[#211C1F]">
                    {task.owner}
                  </p>

                  <p className="text-[9px] text-[#9A9196]">
                    Responsible
                  </p>
                </div>
              </div>

              {/* Status */}
              <span
                className={`hidden rounded-full px-2.5 py-1 text-[9px] font-semibold lg:block ${
                  task.status === "In progress"
                    ? "bg-[#F5EEE5] text-[#87694A]"
                    : "bg-[#F3EAF0] text-[#6D3A5B]"
                }`}
              >
                {task.status}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#F0E9EC] px-6 py-4">
        <p className="text-[10px] text-[#9A9196]">
          Responsibilities can be reassigned when circumstances change.
        </p>

        <motion.button
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[#6D3A5B]"
        >
          View all
          <ArrowUpRight size={13} />
        </motion.button>
      </div>
    </motion.section>
  );
}