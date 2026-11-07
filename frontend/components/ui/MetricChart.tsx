"use client";

import { useId, useState } from "react";

export type ChartPoint = { date: string; value: number | null; comparison?: number | null; details?: string };
export default function MetricChart({ points, label, unit, format = (value) => `${value} ${unit}`, goal, comparisonLabel, variant = "bars" }: { points: ChartPoint[]; label: string; unit: string; format?: (value: number) => string; goal?: number | null; comparisonLabel?: string; variant?: "bars" | "line" }) {
  const [active, setActive] = useState<number | null>(null);
  const tooltipId = useId();
  const values = points.flatMap((point) => [point.value, point.comparison]).filter((value): value is number => value != null);
  if (!values.length) return <div className="flex min-h-48 items-center justify-center rounded-xl bg-[var(--mc-surface-muted)] p-5 text-center text-sm text-[var(--mc-muted)]">Record an entry to see your {label.toLowerCase()} trend. Unrecorded dates stay empty.</div>;
  const observed = points.filter((point) => point.value !== null);
  const isWeight = variant === "line";
  const minValue = isWeight ? Math.max(0, Math.floor(Math.min(...values) - Math.max(1, (Math.max(...values) - Math.min(...values)) * .15))) : 0;
  const maxValue = Math.max(minValue + 1, ...values, goal ?? 0);
  const ceiling = isWeight ? Math.ceil(maxValue + Math.max(1, (maxValue - minValue) * .1)) : Math.ceil(maxValue * 1.15);
  const y = (value: number) => 174 - (value - minValue) / (ceiling - minValue) * 165;
  const first = points[0]?.date;
  const totalDays = points.length > 1 ? Math.max(1, (Date.parse(points.at(-1)!.date) - Date.parse(first)) / 86400000) : 1;
  const x = (point: ChartPoint, index: number) => isWeight ? points.length === 1 ? 300 : 20 + ((Date.parse(point.date) - Date.parse(first)) / 86400000) / totalDays * 560 : (index + .5) / points.length * 600;
  const width = Math.min(42, 600 / points.length * .58);
  const point = active === null ? null : points[active];
  return <div className="relative mt-4 min-w-0">
    <div className="mc-caption mb-3 flex flex-wrap gap-x-4 gap-y-1"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--mc-accent-teal)]" />{label} ({unit})</span>{comparisonLabel && <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--mc-brand)]" />{comparisonLabel}</span>}{goal != null && <span>Dashed line: {format(goal)} goal</span>}</div>
    <div className="flex gap-2"><div className="flex h-44 w-9 shrink-0 flex-col justify-between text-right text-xs tabular-nums text-[var(--mc-muted)]">{[ceiling, (ceiling + minValue) / 2, minValue].map((value, index) => <span key={index}>{Number(value.toFixed(1))}</span>)}</div><div className="relative min-w-0 flex-1">
      <svg viewBox="0 0 600 180" preserveAspectRatio="none" className="h-44 w-full overflow-visible" role="img" aria-label={`${label} trend. ${observed.length} recorded dates. ${isWeight ? "Lines connect recorded measurements; gaps are not additional measurements." : "Unrecorded dates have no bar."}`}>
        {[minValue, (ceiling + minValue) / 2, ceiling].map((value, index) => <line key={index} x1="0" x2="600" y1={y(value)} y2={y(value)} stroke="var(--mc-border)" vectorEffect="non-scaling-stroke" />)}
        {goal != null && <line x1="0" x2="600" y1={y(goal)} y2={y(goal)} stroke="var(--mc-brand)" strokeDasharray="5 5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
        {isWeight && observed.length > 1 && <path d={points.flatMap((item, index) => item.value === null ? [] : [`${index === points.findIndex((entry) => entry.value !== null) ? "M" : "L"}${x(item, index)},${y(item.value)}`]).join(" ")} fill="none" stroke="var(--mc-accent-teal)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
        {points.map((item, index) => <g key={item.date}>{item.comparison != null && <rect x={x(item, index) - width * .65} y={y(item.comparison)} width={width * .6} height={Math.max(0, 174 - y(item.comparison))} rx="3" fill="var(--mc-brand)" opacity=".55" />}{item.value !== null && (isWeight ? <circle cx={x(item, index)} cy={y(item.value)} r="4" fill="var(--mc-accent-teal)" stroke="var(--mc-surface)" strokeWidth="1.5" /> : <rect x={x(item, index) + (comparisonLabel ? 1 : -width / 2)} y={y(item.value)} width={comparisonLabel ? width * .6 : width} height={Math.max(2, 174 - y(item.value))} rx="4" fill="var(--mc-accent-teal)" opacity={active === index ? 1 : .82} />)}</g>)}
      </svg>
      <div className="absolute inset-0 flex">{points.map((item, index) => { const left = index === 0 ? 0 : (x(item, index) + x(points[index - 1], index - 1)) / 2; const right = index === points.length - 1 ? 600 : (x(item, index) + x(points[index + 1], index + 1)) / 2; return <button key={item.date} type="button" className="min-w-0 flex-1 rounded-sm" style={isWeight ? { position: "absolute", top: 0, bottom: 0, left: `${left / 6}%`, width: `${(right - left) / 6}%` } : undefined} aria-label={`${new Date(`${item.date}T12:00:00`).toLocaleDateString("en-IN")}: ${item.value === null ? "Not recorded" : format(item.value)}${item.details ? `; ${item.details}` : ""}`} aria-describedby={active === index ? tooltipId : undefined} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onClick={() => setActive(active === index ? null : index)} />; })}</div>
    </div></div>
    <div className="ml-11 mt-2 flex justify-between gap-1 text-xs text-[var(--mc-muted)]">{points.map((item, index) => <span key={item.date} className="min-w-0 flex-1 text-center">{points.length <= 10 || index === 0 || index === points.length - 1 ? new Date(`${item.date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</span>)}</div>
    {point && <div id={tooltipId} role="tooltip" className="pointer-events-none absolute right-1 top-7 z-10 max-w-[min(270px,90%)] rounded-xl border border-[var(--mc-border)] bg-[var(--mc-surface)] p-3 text-sm text-[var(--mc-text)] shadow-lg"><p className="font-semibold">{new Date(`${point.date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p><p>{label}: {point.value === null ? "Not recorded" : format(point.value)}</p>{point.comparison != null && <p>{comparisonLabel}: {format(point.comparison)}</p>}{goal != null && <p>Goal: {format(goal)}</p>}{point.details && <p className="mc-caption mt-1">{point.details}</p>}</div>}
  </div>;
}
