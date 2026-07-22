// RF-22/23 — histórico acadêmico por período, média global (MGA) e ritmo de formatura.
// Puro (sem Prisma/HTTP): recebe os status já carregados e devolve agregados prontos para a UI.
//
// Convenções:
//  - só APPROVED entra em horas/médias (cursando/simulada não têm nota final);
//  - a média de um período e a MGA são PONDERADAS pela carga horária (CH), como nas
//    universidades federais: Σ(nota × CH) / Σ(CH) — apenas disciplinas com nota lançada;
//  - status sem `term` caem no balde "sem período" (contam horas, não entram na linha do tempo).

export type HistoryItem = {
  seq: number;
  state: "APPROVED" | "ENROLLED" | "SIMULATED";
  term: string | null;
  grade: number | null;
  hours: number;
};

export type TermSummary = {
  term: string;
  hours: number;          // CH aprovada no período
  count: number;          // disciplinas aprovadas
  avg: number | null;     // média ponderada por CH (null se nenhuma nota lançada)
};

const TERM_SORT = (a: string, b: string) => a.localeCompare(b); // "AAAA.S" ordena lexicograficamente

// Média ponderada por CH sobre itens com nota. null quando não há nota nenhuma.
function weightedAvg(items: { grade: number | null; hours: number }[]): number | null {
  let sum = 0, weight = 0;
  for (const it of items) if (it.grade != null && it.hours > 0) { sum += it.grade * it.hours; weight += it.hours; }
  if (weight === 0) return null;
  return Math.round((sum / weight) * 100) / 100;
}

export function termsSummary(items: HistoryItem[]): { terms: TermSummary[]; noTerm: { hours: number; count: number } } {
  const approved = items.filter((i) => i.state === "APPROVED");
  const byTerm = new Map<string, HistoryItem[]>();
  const noTerm = { hours: 0, count: 0 };
  for (const it of approved) {
    if (!it.term) { noTerm.hours += it.hours; noTerm.count += 1; continue; }
    const bucket = byTerm.get(it.term) ?? [];
    bucket.push(it);
    byTerm.set(it.term, bucket);
  }
  const terms = [...byTerm.entries()]
    .map(([term, list]) => ({
      term,
      hours: list.reduce((s, i) => s + i.hours, 0),
      count: list.length,
      avg: weightedAvg(list),
    }))
    .sort((a, b) => TERM_SORT(a.term, b.term));
  return { terms, noTerm };
}

// MGA — média global acadêmica: ponderada por CH sobre TODAS as aprovadas com nota.
export function mga(items: HistoryItem[]): number | null {
  return weightedAvg(items.filter((i) => i.state === "APPROVED"));
}

// Ritmo: CH média dos últimos N períodos com registro e estimativa de períodos restantes.
// remainingHours <= 0 => estTermsLeft 0 (integralizado). Sem histórico por período => null.
export function pace(
  terms: TermSummary[],
  remainingHours: number,
  lastN = 4,
): { avgHoursPerTerm: number | null; estTermsLeft: number | null } {
  if (remainingHours <= 0) return { avgHoursPerTerm: null, estTermsLeft: 0 };
  const recent = terms.slice(-lastN);
  if (recent.length === 0) return { avgHoursPerTerm: null, estTermsLeft: null };
  const avg = recent.reduce((s, t) => s + t.hours, 0) / recent.length;
  if (avg <= 0) return { avgHoursPerTerm: 0, estTermsLeft: null };
  return { avgHoursPerTerm: Math.round(avg), estTermsLeft: Math.ceil(remainingHours / avg) };
}
