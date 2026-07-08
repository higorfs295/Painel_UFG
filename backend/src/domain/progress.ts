// Cálculo de progresso e recomendações (RF-05/07) — puro, sem dependência de Prisma/HTTP,
// para ser testável isoladamente. As rotas apenas carregam os dados e chamam estas funções.
import { statusOf, buildDeps, unlockCount, type Subject, type Milestone, type Status } from "./graph.js";
import { sums, cappedPct, type Extra, type Requirement } from "./sums.js";

export type StatusRecord = { seq: number; state: "APPROVED" | "SIMULATED" };

export type SubjectProgress = Subject & {
  state: "APPROVED" | "SIMULATED" | null;
  status: Status;               // calculado com o conjunto oficial (aprovadas)
};

export type Composition = {
  key: string; label: string; required: number;
  hours: number; pct: number; over: number;   // over = horas além do mínimo (registradas, não exibidas na barra)
};

export type ProgressResult = {
  subjects: SubjectProgress[];
  compositions: Composition[];
  totals: { hours: number; required: number; pct: number };
  milestones: (Milestone & { reached: boolean })[];
  projected: {                                  // inclui SIMULATED (planejamento)
    compositions: Composition[];
    totals: { hours: number; required: number };
    milestones: Record<string, boolean>;
  };
};

function compositions(
  reqs: Requirement[],
  bag: ReturnType<typeof sums>,
): Composition[] {
  const map: Record<string, number> = {
    NC: bag.nc, NEO: bag.neo, OPT: bag.opt, NL: bag.nl, AC: bag.ac,
  };
  return reqs.map(r => {
    const hours = map[r.key] ?? 0;
    return {
      key: r.key, label: r.label, required: r.hours, hours,
      pct: r.hours > 0 ? cappedPct(hours, r.hours) : 0,
      over: Math.max(0, hours - r.hours),
    };
  });
}

export function computeProgress(input: {
  subjects: Subject[];
  milestones: Milestone[];
  requirements: Requirement[];
  statuses: StatusRecord[];
  extras: Extra[];
  totalHours: number;           // carga horária total do curso (Course.totalHours)
}): ProgressResult {
  const { subjects, milestones, requirements, statuses, extras, totalHours } = input;
  const bySeq = new Map(subjects.map(s => [s.seq, s]));
  const stateBySeq = new Map(statuses.map(st => [st.seq, st.state]));

  const approved = new Set(statuses.filter(s => s.state === "APPROVED").map(s => s.seq));
  const projected = new Set(statuses.map(s => s.seq)); // APPROVED ∪ SIMULATED

  const official = sums(subjects, approved, extras);
  const proj = sums(subjects, projected, extras);

  const subjectProgress: SubjectProgress[] = subjects.map(s => ({
    ...s,
    state: stateBySeq.get(s.seq) ?? null,
    status: statusOf(s, approved, official.tot, milestones, bySeq),
  }));

  return {
    subjects: subjectProgress,
    compositions: compositions(requirements, official),
    totals: {
      hours: official.tot, required: totalHours,
      pct: totalHours > 0 ? cappedPct(official.tot, totalHours) : 0,
    },
    milestones: milestones.map(m => ({ ...m, reached: official.tot >= m.hours })),
    projected: {
      compositions: compositions(requirements, proj),
      totals: { hours: proj.tot, required: totalHours },
      milestones: Object.fromEntries(milestones.map(m => [m.key, proj.tot >= m.hours])),
    },
  };
}

export type Recommendation = { seq: number; code: string; name: string; hours: number; ob: number; tot: number };

// RF-07: disciplinas disponíveis ranqueadas pelo destravamento transitivo (obrigatórias primeiro).
export function recommend(input: {
  subjects: Subject[];
  milestones: Milestone[];
  statuses: StatusRecord[];
  limit?: number;
}): Recommendation[] {
  const { subjects, milestones, statuses } = input;
  const bySeq = new Map(subjects.map(s => [s.seq, s]));
  const approved = new Set(statuses.filter(s => s.state === "APPROVED").map(s => s.seq));
  const integralized = sums(subjects, approved, []).tot; // horas oficiais p/ liberar marcos CH1..CH3
  const deps = buildDeps(subjects);

  const recs: Recommendation[] = [];
  for (const s of subjects) {
    if (approved.has(s.seq)) continue;
    if (statusOf(s, approved, integralized, milestones, bySeq) !== "avail") continue;
    const { ob, tot } = unlockCount(s.seq, deps, approved, bySeq);
    recs.push({ seq: s.seq, code: s.code, name: s.name, hours: s.hours, ob, tot });
  }
  recs.sort((a, b) => b.ob - a.ob || b.tot - a.tot || a.seq - b.seq);
  return input.limit ? recs.slice(0, input.limit) : recs;
}
