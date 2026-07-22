// Schemas do módulo de progresso (zod). Separados das rotas para que o contrato de entrada
// seja legível de relance e reaproveitável por testes/documentação.
import { z } from "zod";
import { termString, gradeValue } from "../../lib/schemas.js";

export const enrollBody = z.object({ courseSlug: z.string().min(1) });

/** PATCH da matrícula: só o período de INGRESSO. `.strict()` rejeita `currentTerm` (é global). */
export const enrollmentPatch = z.object({
  startTerm: termString.nullable().optional(),
}).strict();

/** PUT do status da disciplina — estado + dados de histórico (RF-06/19/22). */
export const subjectStatusBody = z.object({
  state: z.enum(["APPROVED", "SIMULATED", "ENROLLED"]).nullable(),
  grade: gradeValue.nullable().optional(),
  absences: z.number().int().min(0).max(999).nullable().optional(),
  term: termString.nullable().optional(),
});

export const recommendationsQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});
