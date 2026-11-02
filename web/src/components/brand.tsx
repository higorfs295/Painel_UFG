// Marca do Painel: uma matriz 2×2 em que uma célula — a próxima disciplina — está acesa.
// SVG simples, sem brilho nem gradiente; funciona no claro e no escuro.
import { APP_NAME } from "@/lib/branding";
import { cx } from "@/lib/utils";

export function BrandMark({ className, onAccent }: { className?: string; onAccent?: boolean }) {
  // `onAccent`: versão branca para ir sobre o laranja (a célula "acesa" fica translúcida)
  const base = onAccent ? "fill-white" : "fill-gray-900 dark:fill-gray-50";
  const lit = onAccent ? "fill-white/45" : "fill-orange-600 dark:fill-orange-500";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx("size-6 shrink-0", className)}>
      <rect x="2" y="2" width="9" height="9" rx="2" className={base} />
      <rect x="13" y="2" width="9" height="9" rx="2" className={base} />
      <rect x="2" y="13" width="9" height="9" rx="2" className={base} />
      <rect x="13" y="13" width="9" height="9" rx="2" className={lit} />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cx("flex items-center gap-2 font-semibold tracking-tight text-gray-900 dark:text-gray-50", className)}>
      <BrandMark />
      <span>{APP_NAME}</span>
    </span>
  );
}
