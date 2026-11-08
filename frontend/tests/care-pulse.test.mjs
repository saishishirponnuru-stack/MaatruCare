import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("../lib/care-pulse.ts", import.meta.url), "utf8"),
  {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const context = {exports: {}};
vm.runInNewContext(compiled, context);
const pulse = context.exports.carePulse;
const task = (id, dueDate, status = "Open") => ({id, title: id, dueDate, status});

test("Care Pulse orders overdue, due-today and upcoming responsibilities from saved statuses", () => {
  const value = pulse([task("3", "2026-11-10"), task("1", "2026-11-06"), task("2", "2026-11-08"), task("4", "2026-11-07", "Completed")], [], [], "2026-11-08");
  assert.equal(value.overdue.length, 1); assert.equal(value.overdue[0].id, "1");
  assert.equal(value.dueToday.length, 1); assert.equal(value.later.length, 1); assert.equal(value.open.length, 3);
});
test("Care Pulse ignores closed and archived handoffs", () => {
  const value = pulse([], [{stage: "Sent"}, {stage: "Sent", archivedAt: "2026-11-01"}, {stage: "Completed"}, {stage: "Cancelled"}, {stage: "Prepared"}], [], "2026-11-08");
  assert.equal(value.waiting.length, 1);
});
test("Care Pulse uses chronological active appointments without fabricating missing dates", () => {
  const appointments = [
    {id: 1, appointment_date: "2026-11-12", appointment_time: "10:00", status: "Scheduled"},
    {id: 2, appointment_date: "2026-11-09", appointment_time: "09:00", status: "Scheduled"},
    {id: 3, appointment_date: "2026-11-07", appointment_time: "09:00", status: "Scheduled"},
    {id: 4, appointment_date: "2026-11-09", appointment_time: "08:00", status: "Cancelled"},
  ];
  const value = pulse([], [], appointments, "2026-11-08");
  assert.equal(value.upcoming.length, 2); assert.equal(value.upcoming[0].id, 2);
});
test("Care Pulse empty and refreshed inputs have no retained account state", () => {
  assert.equal(pulse([task("1", "2026-11-08")], [], [], "2026-11-08").dueToday.length, 1);
  assert.equal(pulse([task("1", "2026-11-08", "Completed")], [], [], "2026-11-08").dueToday.length, 0);
  assert.equal(pulse([], [], [], "2026-11-08").open.length, 0);
});
test("Care Pulse does not call an earlier appointment today upcoming", () => {
  const value = pulse([], [], [
    {id: 1, appointment_date: "2026-11-08", appointment_time: "08:00", status: "Confirmed"},
    {id: 2, appointment_date: "2026-11-08", appointment_time: "16:00", status: "Confirmed"},
  ], "2026-11-08", "12:00");
  assert.equal(value.upcoming.length, 1); assert.equal(value.upcoming[0].id, 2);
});
