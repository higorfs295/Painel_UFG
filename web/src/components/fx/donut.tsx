"use client";

// Rosca de várias fatias (v12) — SVG puro, cada fatia se desenha ao aparecer. Cores pelos nomes
// de `chartColors` (as mesmas dos gráficos da Tremor).
import { cx } from "@/lib/utils";
import { tone } from "@/lib/palette";

const STROKE: Record<string, string> = {
  brand: "stroke-brand-600 dark:stroke-brand-500", emerald: "stroke-emerald-600 dark:stroke-emerald-500",
  blue: "stroke-blue-600 dark:stroke-blue-500", violet: "stroke-violet-600 dark:stroke-violet-500",
  amber: "stroke-amber-600 dark:stroke-amber-500", gray: "stroke-gray-400 dark:stroke-gray-600",
  cyan: "stroke-cyan-600 dark:stroke-cyan-500", indigo: "stroke-indigo-600 dark:stroke-indigo-500",
  fuchsia: "stroke-fuchsia-600 dark:stroke-fuchsia-500", lime: "stroke-lime-600 dark:stroke-lime-500",
  pink: "stroke-pink-600 dark:stroke-pink-500", rose: "stroke-rose-600 dark:stroke-rose-500",
  red: "stroke-red-600 dark:stroke-red-500", sky: "stroke-sky-600 dark:stroke-sky-500", teal: "stroke-teal-600 dark:stroke-teal-500",
};

export type DonutSlice = { label: string; value: number; tone: string };

export function Donut({
  data, size = 120, stroke = 14, label, children, className,
}: { data: DonutSlice[]; size?: number; stroke?: number; label: string; children?: React.ReactNode; className?: string }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0);
  const gap = data.filter((d) => d.value > 0).length > 1 ? 3 : 0; // respiro entre fatias
  let acc = 0;
  const summary = data.map((d) => `${d.label}: ${d.value}`).join(", ");
  return (
    <div role="img" aria-label={`${label} — ${summary}`} className={cx("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-gray-100 dark:stroke-gray-800" />
        {total > 0 && data.map((d, i) => {
          if (d.value <= 0) return null;
          const seg = (d.value / total) * len;
          const dash = Math.max(0, seg - gap);
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
              strokeDasharray={`${dash} ${len - dash}`} strokeDashoffset={-acc}
              className={cx("transition-[stroke-dasharray] duration-700", STROKE[d.tone] ?? STROKE.gray)}
              style={{ animation: `fadeUp .6s ${i * 90}ms both` }} />
          );
          acc += seg;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Legenda em lista para acompanhar a rosca. */
export function DonutLegend({ data, unit = "" }: { data: DonutSlice[]; unit?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-2">
          <span className={cx("size-2.5 shrink-0 rounded-sm", tone(d.tone).dot)} aria-hidden="true" />
          <span className="truncate text-gray-700 dark:text-gray-300">{d.label}</span>
          <span className="ml-auto font-medium tabular-nums text-gray-900 dark:text-gray-50">{d.value}{unit}</span>
          <span className="w-10 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">{Math.round((d.value / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}
