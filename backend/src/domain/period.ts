// RF-20 v2 — período letivo GLOBAL via calendário acadêmico agendável (gerido pelos admins).
// O período corrente = última entrada do calendário com startsAt <= agora; a próxima entrada
// futura diz o que vem depois ("Férias · próximo: 2026.2"). Sem calendário cadastrado, cai na
// heurística de meses (mar–jul = .1, ago–dez = .2, jan/fev = férias) como sugestão.

export type PeriodInfo = {
  term: string | null;   // "2026.2" quando em período letivo, null em férias
  onBreak: boolean;      // true = férias/recesso
  label: string;         // texto pronto para a UI: "2026.2" | "Férias"
  nextTerm: string;      // o que vem a seguir (rótulo do próximo TERM, ou heurística)
  source: "calendar" | "heuristic"; // de onde veio a resposta
  nextStartsAt?: string; // ISO da próxima virada agendada (quando houver)
};

export type CalendarRow = {
  type: "TERM" | "BREAK";
  term: string | null;
  startsAt: Date;
};

export function resolvePeriod(rows: CalendarRow[], now: Date = new Date()): PeriodInfo {
  const sorted = [...rows].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const current = [...sorted].reverse().find((r) => r.startsAt <= now);
  if (!current) return { ...heuristic(now), source: rows.length ? "calendar" : "heuristic" };

  const future = sorted.filter((r) => r.startsAt > now);
  const nextEntry = future[0];
  const nextTermEntry = future.find((r) => r.type === "TERM");

  const onBreak = current.type === "BREAK";
  const term = onBreak ? null : current.term ?? null;
  return {
    term,
    onBreak,
    label: onBreak ? "Férias" : term ?? "Período",
    nextTerm: nextTermEntry?.term ?? heuristic(now).nextTerm,
    source: "calendar",
    ...(nextEntry ? { nextStartsAt: nextEntry.startsAt.toISOString() } : {}),
  };
}

// Heurística de calendário típico (fallback/sugestão quando não há calendário cadastrado).
export function heuristic(now: Date = new Date()): PeriodInfo {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1..12
  if (m >= 3 && m <= 7)
    return { term: `${y}.1`, onBreak: false, label: `${y}.1`, nextTerm: `${y}.2`, source: "heuristic" };
  if (m >= 8 && m <= 12)
    return { term: `${y}.2`, onBreak: false, label: `${y}.2`, nextTerm: `${y + 1}.1`, source: "heuristic" };
  return { term: null, onBreak: true, label: "Férias", nextTerm: `${y}.1`, source: "heuristic" };
}

export const TERM_RE = /^\d{4}\.[12]$/; // validação de formato (zod .regex(TERM_RE))
