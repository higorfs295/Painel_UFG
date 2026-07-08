// Cálculo de progresso e recomendações (RF-05/07) — puro, sem dependência de Prisma/HTTP,
// para ser testável isoladamente. As rotas apenas carregam os dados e chamam estas funções.
import { statusOf, buildDeps, unlockCount, type Subject, type Milestone, type Status } from "./graph.js";
import { sums, cappedPct, type Extra, type Requirement, type Minimums } from "./sums.js";

export type StatusRecord = { seq: number; state: "APPROVED" | "SIMULATED" };

export type SubjectProgress = Subject & {
  state: "APPROVED" | "SIMULATED" | null;
  status: Status;
};

export type Composition = {
  key: string; label: string; required: number;
  hours: number; pct: number; over: number;
};

export type ProgressResult = {
  subjects: SubjectProgress[];
  compositions: Composition[];
  totals: { hours: number; required: number; pct: number };
  milestones: (Milestone & { reached: boolean })[];
  projected: {
    compositions: Composition[];
    totals: { hours: number; required: number };
    milestones: Record<string, boolean>;
  };
};

// Deriva os mínimos {nc,neo,opt,nl,ac} a partir das requirements do curso (multi-curso: nada fixo).
// Chaves ausentes viram 0. Confira que os `key` no banco são NC/NEO/OPT/NL/AC.
function minimumsFrom(reqs: Requirement[]): Minimums {
  const byKey: Record<string, number> = {};
  for (const r of reqs) byKey[r.key] = r.hours;
  return {
    nc:  byKey["NC"]  ?? 0,
    neo: byKey["NEO"] ?? 0,
    opt: byKey["OPT"] ?? 0,
    nl:  byKey["NL"]  ?? 0,
    ac:  byKey["AC"]  ?? 0,
  };
}

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
  totalHours: number;
}): ProgressResult {
  const { subjects, milestones, requirements, statuses, extras, totalHours } = input;
  const bySeq = new Map(subjects.map(s => [s.seq, s]));
  const stateBySeq = new Map(statuses.map(st => [st.seq, st.state]));
  const minimums = minimumsFrom(requirements);

  const approved = new Set(statuses.filter(s => s.state === "APPROVED").map(s => s.seq));
  const projected = new Set(statuses.map(s => s.seq));

  const official = sums(subjects, approved, extras, minimums);
  const proj = sums(subjects, projected, extras, minimums);

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

export function recommend(input: {
  subjects: Subject[];
  milestones: Milestone[];
  requirements: Requirement[];      // <-- agora precisa das requirements p/ os mínimos
  statuses: StatusRecord[];
  limit?: number;
}): Recommendation[] {
  const { subjects, milestones, requirements, statuses } = input;
  const bySeq = new Map(subjects.map(s => [s.seq, s]));
  const approved = new Set(statuses.filter(s => s.state === "APPROVED").map(s => s.seq));
  const minimums = minimumsFrom(requirements);
  const integralized = sums(subjects, approved, [], minimums).tot;
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