"use client";

// Número que conta até o valor ao aparecer (v12). O valor final fica no DOM para leitores de
// tela e testes (sr-only); o que anima é só a cópia visual, marcada como decorativa.
import { useTween } from "./motion";
import { cx } from "@/lib/utils";

const nf = (d: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function CountUp({
  value, decimals = 0, prefix = "", suffix = "", duration, className,
}: {
  value: number; decimals?: number; prefix?: string; suffix?: string; duration?: number; className?: string;
}) {
  const shown = useTween(value, duration);
  const f = nf(decimals);
  return (
    <span className={cx("tabular-nums", className)}>
      <span className="sr-only">{prefix}{f.format(value)}{suffix}</span>
      <span aria-hidden="true">{prefix}{f.format(shown)}{suffix}</span>
    </span>
  );
}
