// Primitivos zod compartilhados. Antes cada rota redeclarava `z.object({ id: z.string() })`
// e variações de paginação; centralizar evita divergência de mensagens e de limites.
import { z } from "zod";
import { TERM_RE } from "../domain/period.js";

/** Parâmetro de rota `:id`. */
export const idParam = z.object({ id: z.string().min(1) });

/** Fábrica para parâmetros nomeados (`:subjectId`, `:taskId`...). */
export const paramOf = <K extends string>(key: K) =>
  z.object({ [key]: z.string().min(1) } as Record<K, z.ZodString>);

/** Período letivo no formato AAAA.S (ex.: "2026.2"). */
export const termString = z.string().regex(TERM_RE, "formato AAAA.S (ex.: 2026.2)");

/** Paginação simples por limite, com teto para não permitir varredura da tabela. */
export const limitQuery = (def = 50, max = 200) =>
  z.object({ limit: z.coerce.number().int().positive().max(max).default(def) });

/** Nota final 0..10 (aceita null para limpar). */
export const gradeValue = z.number().min(0).max(10);
