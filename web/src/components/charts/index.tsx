"use client";

// Gráficos e blocos de métrica no desenho da Tremor.
//
// • `LineChart` (recharts) é o componente do tremorlabs/template-dashboard (MIT), em
//   components/tremor/LineChart — usado para séries por período.
// • Aqui ficam as peças pequenas, sem biblioteca: título de bloco, métrica, barras
//   horizontais (o BarList da Tremor) e a barra empilhada (o CategoryBar do cartão
//   "Costs" do template).
import type { ComponentType, ReactNode, SVGProps } from "react";
import { cx, num } from "@/lib/utils";
import { ProgressCircle } from "@/components/tremor/ProgressCircle";

export function ChartTitle({ title, hint }: {
  /** mantido por compatibilidade; a Tremor não põe ícone no título */
  icon?: ComponentType<SVGProps<SVGSVGElement>>; title: string; hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <h3 className="font-semibold text-gray-900 sm:text-sm dark:text-gray-50">{title}</h3>
      {hint && <span className="text-sm text-gray-500 dark:text-gray-400">{hint}</span>}
    </div>
  );
}

/** Métrica do template: rótulo pequeno, valor em text-xl sem peso extra, nota opcional. */
export function MetricCard({ title, value, sub }: {
  title: string; value: ReactNode; sub?: string;
  /** mantido por compatibilidade */
  color?: string;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-xl text-gray-900 tabular-nums dark:text-gray-50">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  );
}

/** Anel de progresso = Tremor Raw ProgressCircle com o percentual no centro. */
export function DonutProgress({ pct, label, size = 136 }: { pct: number; label?: string; size?: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <ProgressCircle value={clamped} radius={size / 2 - 6} strokeWidth={8} aria-label={`${clamped.toFixed(0)}% ${label ?? ""}`}>
      <div className="text-center">
        <p className="text-xl font-medium text-gray-900 tabular-nums dark:text-gray-50">{clamped.toFixed(0)}%</p>
        {label && <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>}
      </div>
    </ProgressCircle>
  );
}

export type BarDatum = { label: string; value: number; hint?: string };

/** BarList da Tremor: barra clara com o rótulo por dentro e o valor à direita. */
export function BarList({ data, unit = "", tone = "orange" }: {
  data: BarDatum[]; unit?: string; tone?: "orange" | "red" | "gray";
  /** mantido por compatibilidade (cor CSS antiga) */
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const bar = {
    orange: "bg-orange-200 dark:bg-orange-500/30",
    red: "bg-red-200 dark:bg-red-500/30",
    gray: "bg-gray-200 dark:bg-gray-700",
  }[tone];
  return (
    <ul className="flex flex-col gap-1.5">
      {data.map((d) => (
        <li key={d.label} className="flex items-center justify-between gap-6">
          <div className="relative flex h-8 min-w-0 flex-1 items-center">
            <div className={cx("absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500", bar)}
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
            <p className="relative truncate px-2 text-sm text-gray-900 dark:text-gray-50" title={d.hint}>
              {d.label}{d.hint && <span className="text-gray-500 dark:text-gray-400"> · {d.hint}</span>}
            </p>
          </div>
          <p className="shrink-0 text-sm font-medium text-gray-900 tabular-nums dark:text-gray-50">{num(d.value)}{unit}</p>
        </li>
      ))}
    </ul>
  );
}

/** Barra empilhada + legenda — o bloco "Current costs" do template. */
export function StackedBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = Math.max(1, parts.reduce((t, p) => t + p.value, 0));
  return (
    <div>
      <div className="flex items-center gap-0.5">
        {parts.map((p) => (
          <div key={p.label} title={`${p.label}: ${num(p.value)}h`} className={cx("h-1.5 rounded-full", p.color)}
            style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <ul role="list" className="mt-4 space-y-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-xs">
            <span className={cx("size-2.5 rounded-xs", p.color)} aria-hidden="true" />
            <span className="text-gray-900 dark:text-gray-50">{p.label}</span>
            <span className="text-gray-600 tabular-nums dark:text-gray-400">({num(p.value)} h / {((p.value / total) * 100).toFixed(1).replace(".", ",")}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
