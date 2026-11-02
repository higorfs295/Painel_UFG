"use client";

// Cartões da visão geral, adaptados de tremorlabs/template-dashboard (MIT, © 2025 Tremor
// Labs, Inc.): DashboardProgressBarCard, DashboardCategoryBarCard e DashboardChartCard.
// Mesma marcação e mesmas classes; os dados agora vêm da matriz e do histórico do aluno,
// e o link de rodapé ("cta") virou um <Link> do Next.
import { tone } from "@/lib/palette";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/tremor/Badge";
import { ProgressBar } from "@/components/tremor/ProgressBar";
import { LineChart } from "@/components/tremor/LineChart";
import { cx } from "@/lib/utils";

export type KpiEntry = { title: string; percentage: number; current: string; allowed: string; unit?: string; hint?: string; tone?: string };

type CtaProps = { ctaDescription: string; ctaText: string; ctaLink: string };

function Cta({ ctaDescription, ctaText, ctaLink }: CtaProps) {
  return (
    <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
      {ctaDescription}{" "}
      <Link href={ctaLink} className="text-brand-700 hover:underline dark:text-brand-400">{ctaText}</Link>
    </p>
  );
}

export function ProgressBarCard({ title, change, changeVariant = "neutral", value, valueDescription, data, ...cta }: {
  title: string; change?: string; changeVariant?: "neutral" | "success" | "warning" | "error" | "default";
  value: string; valueDescription: string; data: KpiEntry[];
} & CtaProps) {
  return (
    <div className="flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 sm:text-sm dark:text-gray-50">{title}</h3>
          {change && <Badge variant={changeVariant}>{change}</Badge>}
        </div>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-xl text-gray-900 tabular-nums dark:text-gray-50">{value}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{valueDescription}</span>
        </p>
        <ul role="list" className="mt-4 space-y-5">
          {data.map((item) => (
            <li key={item.title}>
              <p className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-50" title={item.hint ?? item.title}>{item.title}</span>
                <span className="font-medium whitespace-nowrap text-gray-900 tabular-nums dark:text-gray-50">
                  {item.current}
                  <span className="font-normal text-gray-500 dark:text-gray-400">/{item.allowed}{item.unit}</span>
                </span>
              </p>
              {item.tone ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" role="progressbar"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.percentage)} aria-label={item.title}>
                  <div className={cx("bar-grow h-full rounded-full", tone(item.tone).dot)} style={{ width: `${Math.min(100, item.percentage)}%` }} />
                </div>
              ) : (
                <ProgressBar value={item.percentage} className="mt-2 [&>*]:h-1.5" />
              )}
            </li>
          ))}
        </ul>
      </div>
      <Cta {...cta} />
    </div>
  );
}

export type KpiEntryExtended = { title: string; percentage: number; value: string; color: string };

export function CategoryBarCard({ title, change, value, valueDescription, subtitle, data, ...cta }: {
  title: string; change?: string; value: string; valueDescription: string; subtitle: string; data: KpiEntryExtended[];
} & CtaProps) {
  return (
    <div className="flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 sm:text-sm dark:text-gray-50">{title}</h3>
          {change && <Badge variant="neutral">{change}</Badge>}
        </div>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-xl text-gray-900 tabular-nums dark:text-gray-50">{value}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{valueDescription}</span>
        </p>
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{subtitle}</p>
          <div className="mt-2 flex items-center gap-0.5" aria-hidden="true">
            {data.filter((d) => d.percentage > 0).map((item) => (
              <div key={item.title} className={cx(item.color, "h-1.5 rounded-full")} style={{ width: `${item.percentage}%` }} />
            ))}
          </div>
        </div>
        <ul role="list" className="mt-5 space-y-2">
          {data.map((item) => (
            <li key={item.title} className="flex items-center gap-2 text-xs">
              <span className={cx(item.color, "size-2.5 rounded-xs")} aria-hidden="true" />
              <span className="text-gray-900 dark:text-gray-50">{item.title}</span>
              <span className="text-gray-600 tabular-nums dark:text-gray-400">
                ({item.value} / {item.percentage.toFixed(1).replace(".", ",")}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
      <Cta {...cta} />
    </div>
  );
}

/** Variação entre os dois últimos pontos → variante do Badge (mesma regra do template). */
export function badgeFor(change: number | null) {
  if (change == null || !Number.isFinite(change)) return "neutral" as const;
  if (change > 0) return "success" as const;
  if (change < 0) return change < -0.5 ? ("warning" as const) : ("error" as const);
  return "neutral" as const;
}

export const pctChange = (change: number | null) =>
  change == null || !Number.isFinite(change)
    ? "—"
    : `${change > 0 ? "+" : ""}${(change * 100).toFixed(1).replace(".", ",")}%`;

/** ChartCard do template: título + badge de variação, valor do último ponto e a linha. */
export function ChartCard({ title, points, format, previousLabel }: {
  title: string;
  points: { label: string; value: number | null }[];
  format: (v: number) => string;
  previousLabel?: ReactNode;
}) {
  const valid = points.filter((p) => p.value != null) as { label: string; value: number }[];
  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  const change = last && prev && prev.value !== 0 ? (last.value - prev.value) / prev.value : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-x-2">
        <div className="flex items-center gap-x-2">
          <h3 className="font-bold text-gray-900 sm:text-sm dark:text-gray-50">{title}</h3>
          {prev && <Badge variant={badgeFor(change)}>{pctChange(change)}</Badge>}
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <p className="text-xl text-gray-900 tabular-nums dark:text-gray-50">{last ? format(last.value) : "—"}</p>
        {prev && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {previousLabel ?? <>antes: {format(prev.value)} ({prev.label})</>}
          </p>
        )}
      </div>
      <LineChart
        className="mt-6 h-32"
        data={points.map((p) => ({ periodo: p.label, [title]: p.value }))}
        index="periodo"
        colors={["brand"]}
        startEndOnly
        valueFormatter={(v) => format(v as number)}
        showYAxis={false}
        showLegend={false}
        categories={[title]}
        connectNulls
        autoMinValue
      />
    </div>
  );
}
