import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Junta classes condicionais e resolve conflitos do Tailwind (a última vence).
 * Convenção herdada do nextjs-admin-dashboard / visactor-next-template.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata número no padrão pt-BR (separador de milhar). */
export const num = (n: number) => n.toLocaleString("pt-BR");

/** Nota/decimal em pt-BR; devolve travessão quando não há valor. */
export const dec = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "—" : n.toFixed(digits).replace(".", ",");

/** Iniciais para avatares (no máximo duas). */
export const initials = (name: string | undefined) =>
  (name ?? "?").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

export const fmtDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "short", year: "numeric",
});

// ── Utilitários da Tremor (tremorlabs/template-dashboard, MIT) — acento laranja ──

/** Mesmo que `cn`; nome usado pelos componentes portados da Tremor. */
export const cx = cn;

// Tremor Raw focusInput [v0.0.1]
export const focusInput = [
  "focus:ring-2",
  "focus:ring-orange-200 dark:focus:ring-orange-700/30",
  "focus:border-orange-500 dark:focus:border-orange-700",
];

// Tremor Raw focusRing [v0.0.1]
export const focusRing = [
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  "outline-orange-500 dark:outline-orange-500",
];

// Tremor Raw hasErrorInput [v0.0.1]
export const hasErrorInput = [
  "ring-2",
  "border-red-500 dark:border-red-700",
  "ring-red-200 dark:ring-red-700/30",
];
