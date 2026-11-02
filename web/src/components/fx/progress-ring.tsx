"use client";

// Anel de progresso com degradê na cor de destaque e traço que se desenha ao aparecer (v12).
// O ProgressCircle da Tremor continua para os anéis pequenos; este é o "herói" das páginas.
import { useId } from "react";
import { cx } from "@/lib/utils";

const STOPS: Record<string, [string, string]> = {
  brand: ["var(--color-brand-400)", "var(--color-brand-700)"],
  emerald: ["var(--color-emerald-400)", "var(--color-emerald-700)"],
  blue: ["var(--color-blue-400)", "var(--color-blue-700)"],
  violet: ["var(--color-violet-400)", "var(--color-violet-700)"],
  amber: ["var(--color-amber-400)", "var(--color-amber-700)"],
};

export function ProgressRing({
  value, size = 132, stroke = 12, tone = "brand", label, children, className,
}: {
  /** 0–100 */
  value: number; size?: number; stroke?: number; tone?: keyof typeof STOPS | string;
  /** nome acessível ("62% integralizado") */
  label: string;
  children?: React.ReactNode; className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const [a, b] = STOPS[tone] ?? STOPS.brand!;
  return (
    <div role="img" aria-label={label} className={cx("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a} />
            <stop offset="100%" stopColor={b} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          className="stroke-gray-200/80 dark:stroke-gray-800" />
        {/* trilho tracejado por cima do fundo: a "régua" do template-solar */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={1} strokeDasharray="2 6"
          className="stroke-gray-300 dark:stroke-gray-700" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#g${id})`} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - pct / 100)}
          className="draw" style={{ ["--len" as string]: len }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
