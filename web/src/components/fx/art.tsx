"use client";

// Peças gráficas pequenas (v12): medalha das conquistas, arte dos estados vazios e o
// "cartão de número" dos painéis. SVG/HTML desenhados em código — nenhuma imagem gerada.
import { cx } from "@/lib/utils";
import { tone as toneOf } from "@/lib/palette";
import { CountUp } from "./count-up";
import { Sparkline } from "./sparkline";

const MEDAL: Record<string, [string, string]> = {
  emerald: ["var(--color-emerald-300)", "var(--color-emerald-600)"],
  blue: ["var(--color-blue-300)", "var(--color-blue-600)"],
  violet: ["var(--color-violet-300)", "var(--color-violet-600)"],
  amber: ["var(--color-amber-300)", "var(--color-amber-600)"],
  brand: ["var(--color-brand-300)", "var(--color-brand-600)"],
  pink: ["var(--color-pink-300)", "var(--color-pink-600)"],
  cyan: ["var(--color-cyan-300)", "var(--color-cyan-600)"],
};

/** Medalha: fita + disco com borda serrilhada; apagada quando ainda não conquistada. */
export function Medal({ icon, tone = "brand", earned, size = 56 }: { icon: React.ReactNode; tone?: string; earned: boolean; size?: number }) {
  const [a, b] = MEDAL[tone] ?? MEDAL.brand!;
  const id = `m-${tone}-${earned ? 1 : 0}`;
  return (
    <span className={cx("relative inline-grid place-items-center", !earned && "opacity-45 grayscale")} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} />
          </linearGradient>
        </defs>
        <path d="M22 4h8l4 18h-8zM34 4h8l-4 18h-8z" fill={b} opacity="0.55" />
        <path d="M32 18l3.1 2.3 3.8-.4 1.6 3.5 3.5 1.6-.4 3.8L46 32l-2.4 3.2.4 3.8-3.5 1.6-1.6 3.5-3.8-.4L32 46l-3.1-2.3-3.8.4-1.6-3.5-3.5-1.6.4-3.8L18 32l2.4-3.2-.4-3.8 3.5-1.6 1.6-3.5 3.8.4z"
          fill={`url(#${id})`} transform="translate(0 6)" />
        <circle cx="32" cy="38" r="9.5" fill="white" opacity="0.92" />
      </svg>
      <span className="absolute top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-base leading-none">{icon}</span>
    </span>
  );
}

/** Arte dos estados vazios: caixa tracejada com hachura e um ícone flutuando (Solar). */
export function EmptyArt({ icon: Icon, className }: { icon: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <div aria-hidden="true" className={cx("relative mx-auto grid h-24 w-36 place-items-center", className)}>
      <div className="hatch absolute inset-0 rounded-lg border border-dashed border-gray-300 text-gray-200 dark:border-gray-700 dark:text-gray-800" />
      <div className="floaty relative grid size-12 place-items-center rounded-xl border border-gray-200 bg-white shadow-md dark:border-gray-800 dark:bg-gray-900">
        <Icon className="size-6 text-brand-600 dark:text-brand-400" />
      </div>
    </div>
  );
}

/** Cartão de número: ícone em selo colorido, valor contando, variação e minigráfico. */
export function StatTile({
  label, value, decimals = 0, suffix = "", hint, icon: Icon, tone = "brand", trend, delta, className,
}: {
  label: string; value: number; decimals?: number; suffix?: string; hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>; tone?: string;
  trend?: number[]; delta?: { value: string; positive: boolean } | null; className?: string;
}) {
  const t = toneOf(tone);
  return (
    <div className={cx(
      "group relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-xs transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-950",
      className,
    )}>
      <div aria-hidden="true" className={cx("absolute inset-x-0 top-0 h-0.5 opacity-80", t.dot)} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
        {Icon && (
          <span aria-hidden="true" className={cx("grid size-8 place-items-center rounded-md ring-1 ring-inset transition group-hover:scale-110", t.soft)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <CountUp value={value} decimals={decimals} suffix={suffix} className="text-2xl font-semibold text-gray-900 dark:text-gray-50" />
        {delta && (
          <span className={cx("rounded-sm px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", delta.positive ? toneOf("emerald").soft : toneOf("red").soft)}>
            {delta.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      {trend && trend.length > 1 && <Sparkline data={trend} tone={tone} className="mt-3" />}
    </div>
  );
}
