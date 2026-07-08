import { describe, it, expect } from "vitest";
import { computeProgress, recommend, type StatusRecord } from "../../src/domain/progress.js";
import type { Subject, Milestone } from "../../src/domain/graph.js";
import type { Extra, Requirement } from "../../src/domain/sums.js";

const S = (over: Partial<Subject> & { seq: number }): Subject => ({
  code: `C${over.seq}`, name: `Disc ${over.seq}`, hours: 64, nucleus: "NE", groupOpt: 0,
  pre: [], co: [], ...over,
});

const subjects: Subject[] = [
  S({ seq: 1, nucleus: "NC", hours: 200 }),
  S({ seq: 2, nucleus: "NE", hours: 100 }),
  S({ seq: 3, nucleus: "NE", hours: 100, groupOpt: 2 }), // optativa
  S({ seq: 4, nucleus: "NE", hours: 100, pre: [2] }),    // disponível após 2
];
const milestones: Milestone[] = [
  { key: "CH1", hours: 400, description: "" },
  { key: "CH2", hours: 500, description: "" },
];
const requirements: Requirement[] = [
  { key: "NC", label: "Núcleo Comum", hours: 100 },
  { key: "NEO", label: "Específico Obrigatório", hours: 500 },
  { key: "OPT", label: "Optativo", hours: 320 },
  { key: "NL", label: "Núcleo Livre", hours: 128 },
  { key: "AC", label: "Atividades", hours: 100 },
];
const extras: Extra[] = [
  { hours: 128, category: "NL", done: true },
  { hours: 50, category: "AC", done: false }, // planejado: não soma
];
// oficiais: 1,2 aprovadas; 3 simulada
const statuses: StatusRecord[] = [
  { seq: 1, state: "APPROVED" },
  { seq: 2, state: "APPROVED" },
  { seq: 3, state: "SIMULATED" },
];

describe("computeProgress", () => {
  const r = computeProgress({ subjects, milestones, requirements, statuses, extras, totalHours: 1148 });

  it("soma apenas aprovadas + extras concluídos (oficial)", () => {
    expect(r.totals.hours).toBe(428); // 200 NC + 100 NEO + 128 NL
  });

  it("trava a barra em 100% mas registra o excedente (RF-05)", () => {
    const nc = r.compositions.find(c => c.key === "NC")!;
    expect(nc.hours).toBe(200);
    expect(nc.pct).toBe(100);   // capado
    expect(nc.over).toBe(100);  // 100h além do mínimo, registradas
  });

  it("planejado (done=false) não conta", () => {
    const ac = r.compositions.find(c => c.key === "AC")!;
    expect(ac.hours).toBe(0);
  });

  it("marca status por disciplina", () => {
    const byId = new Map(r.subjects.map(s => [s.seq, s]));
    expect(byId.get(1)!.status).toBe("done");
    expect(byId.get(3)!.state).toBe("SIMULATED");
    expect(byId.get(4)!.status).toBe("avail"); // pré (2) aprovada
  });

  it("marcos: oficial cruza CH1 mas não CH2; projeção cruza os dois", () => {
    const m = new Map(r.milestones.map(x => [x.key, x.reached]));
    expect(m.get("CH1")).toBe(true);
    expect(m.get("CH2")).toBe(false);
    expect(r.projected.totals.hours).toBe(528); // + optativa simulada (100 OPT)
    expect(r.projected.milestones.CH2).toBe(true);
  });
});

describe("recommend", () => {
  it("ranqueia disponíveis por destravamento (obrigatórias primeiro)", () => {
    const recs = recommend({ subjects, milestones, statuses });
    const seqs = recs.map(r => r.seq);
    expect(seqs).toContain(4); // avail
    expect(seqs).not.toContain(1); // já aprovada
    expect(seqs).not.toContain(2); // já aprovada
  });
});
