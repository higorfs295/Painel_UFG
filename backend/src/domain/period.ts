// RF-20 — período letivo corrente e férias. Heurística baseada no calendário típico da UFG
// (semestre .1 ≈ março–julho, .2 ≈ agosto–dezembro; janeiro/fevereiro = férias/recesso).
// É uma SUGESTÃO de exibição: o valor persistido (Enrollment.currentTerm) é a fonte de verdade
// e o usuário pode ajustá-lo nas configurações — calendários reais variam ano a ano.

export type PeriodInfo = {
  term: string | null;   // "2026.2" quando em período letivo (pela heurística), null em férias
  onBreak: boolean;      // true = férias/recesso
  label: string;         // texto pronto para a UI: "2026.2" | "Férias"
  nextTerm: string;      // período seguinte (para exibir "Férias · próximo: 2027.1")
};

export function periodInfo(now: Date = new Date()): PeriodInfo {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1..12
  if (m >= 3 && m <= 7) {
    return { term: `${y}.1`, onBreak: false, label: `${y}.1`, nextTerm: `${y}.2` };
  }
  if (m >= 8 && m <= 12) {
    return { term: `${y}.2`, onBreak: false, label: `${y}.2`, nextTerm: `${y + 1}.1` };
  }
  // janeiro/fevereiro: férias entre .2 do ano anterior e .1 do corrente
  return { term: null, onBreak: true, label: "Férias", nextTerm: `${y}.1` };
}

// Compara "2026.1"-style terms. Retorna <0, 0, >0 (útil para ordenar/validar progressão).
export function compareTerms(a: string, b: string): number {
  const [ay, as] = a.split(".").map(Number);
  const [by, bs] = b.split(".").map(Number);
  return (ay! - by!) || (as! - bs!);
}

export const TERM_RE = /^\d{4}\.[12]$/; // validação de formato (zod .regex(TERM_RE))
