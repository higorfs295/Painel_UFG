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
