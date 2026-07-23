"use client";

// Gráficos em SVG puro.
//
// Os templates de dashboard trazem bibliotecas pesadas (ApexCharts no admin dashboard,
// VisActor no visactor-next-template) e, junto, o problema clássico do App Router: elas
// tocam `window` na importação e precisam de `dynamic(..., { ssr: false })`, o que
// atrasa o primeiro desenho e engorda o bundle.
//
// O que este painel precisa desenhar é modesto — anel de progresso, barras por período,
// linha de ritmo, distribuição por curso. Em SVG isso sai em poucas linhas, renderiza no
// servidor, herda os tokens de cor do tema e não custa um quilobyte de JavaScript extra.
// O que foi realmente aproveitado dos templates é a COMPOSIÇÃO do visactor: título com
// ícone + cartões de métrica ao lado do desenho.
import type { ComponentType, SVGProps } from "react";
import { cn, num } from "@/lib/utils";

export function ChartTitle({ icon: Icon, title, hint }: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>; title: string; hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="text-primary" />}
      <h3 className="section-label !mb-0">{title}</h3>
      {hint && <span className="text-subtle-foreground text-xs">{hint}</span>}
    </div>
  );
}

export function MetricCard({ title, value, sub, color = "var(--color-primary)" }: {
  title: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="border-l-2 pl-3" style={{ borderColor: color }}>
      <span className="text-muted-foreground block text-xs">{title}</span>
      <strong className="font-display block text-2xl font-semibold tracking-tight">{value}</strong>
      {sub && <span className="text-subtle-foreground block text-xs">{sub}</span>}
    </div>
  );
}

/** Anel de progresso — o número grande da integralização. */
export function DonutProgress({ pct, label, size = 168 }: { pct: number; label?: string; size?: number }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="grid place-items-center">
      <svg viewBox="0 0 160 160" width={size} height={size} role="img"
        aria-label={`${clamped.toFixed(0)}% integralizado`}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="12" />
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--color-primary)" strokeWidth="12"
          strokeLinecap="round" transform="rotate(-90 80 80)"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - clamped / 100)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)" }} />
        <text x="80" y="76" textAnchor="middle" className="font-display" fill="var(--color-foreground)"
          fontSize="30" fontWeight="650">{clamped.toFixed(0)}%</text>
        {label && (
          <text x="80" y="98" textAnchor="middle" fill="var(--color-muted-foreground)" fontSize="10"
            letterSpacing="1.4">{label}</text>
        )}
      </svg>
    </div>
  );
}

export type BarDatum = { label: string; value: number; hint?: string };

/** Barras horizontais — carga horária por período, matrículas por curso. */
export function BarList({ data, unit = "", color = "var(--color-primary)" }: {
  data: BarDatum[]; unit?: string; color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="text-muted-foreground mb-1 flex justify-between gap-3 text-xs">
            <span className="truncate"><b className="text-foreground">{d.label}</b>{d.hint && ` · ${d.hint}`}</span>
            <span>{num(d.value)}{unit}</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Linha com área — evolução da carga horária por período. */
export function AreaSpark({ points, className }: { points: { x: string; y: number }[]; className?: string }) {
  if (points.length === 0) return null;
  const w = 320, h = 96, pad = 6;
  const max = Math.max(1, ...points.map((p) => p.y));
  // com um único ponto não há intervalo: desenha no meio para não dividir por zero
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const at = (i: number) => (points.length > 1 ? pad + i * stepX : w / 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${at(i)},${y(p.y)}`).join(" ");
  const area = `${line} L${at(points.length - 1)},${h - pad} L${at(0)},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full", className)} role="img"
      aria-label="Carga horária por período">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.x} cx={at(i)} cy={y(p.y)} r="3" fill="var(--color-background)"
          stroke="var(--color-primary)" strokeWidth="2" />
      ))}
    </svg>
  );
}

/** Barras empilhadas horizontais numa faixa só — composição das horas. */
export function StackedBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = Math.max(1, parts.reduce((t, p) => t + p.value, 0));
  return (
    <div>
      <div className="bg-muted flex h-3 overflow-hidden rounded-full">
        {parts.map((p) => (
          <span key={p.label} title={`${p.label}: ${num(p.value)}h`}
            style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.label} <b className="text-foreground">{num(p.value)}h</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
