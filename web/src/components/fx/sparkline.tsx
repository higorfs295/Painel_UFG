"use client";

// Minigráfico de linha com área em degradê (v12) — para os cartões de número. SVG puro: a
// linha se desenha ao aparecer (pathLength=1 + a classe .draw).
import { useId } from "react";
import { cx } from "@/lib/utils";

const COLORS: Record<string, string> = {
  brand: "var(--color-brand-500)", emerald: "var(--color-emerald-500)", blue: "var(--color-blue-500)",
  violet: "var(--color-violet-500)", amber: "var(--color-amber-500)", red: "var(--color-red-500)",
  cyan: "var(--color-cyan-500)", pink: "var(--color-pink-500)", gray: "var(--color-gray-400)",
};

export function Sparkline({
  data, tone = "brand", height = 36, className, label,
}: { data: number[]; tone?: string; height?: number; className?: string; label?: string }) {
  const id = useId().replace(/:/g, "");
  const w = 120;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => [data.length === 1 ? w : (i / (data.length - 1)) * w, height - 3 - (v / max) * (height - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = pts.length ? `${line} L${w},${height} L0,${height} Z` : "";
  const color = COLORS[tone] ?? COLORS.brand!;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cx("h-9 w-full overflow-visible", className)}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#s${id})`} className="page-enter" />}
      {line && (
        <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round"
          vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} className="draw" style={{ ["--len" as string]: 1 }} />
      )}
      {pts.length > 0 && (
        <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="2.5" fill={color} className="page-enter" />
      )}
    </svg>
  );
}
