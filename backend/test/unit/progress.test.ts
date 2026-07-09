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

describe("computeProgress (integralização limitada ao mínimo por composição)", () => {
  const r = computeProgress({ subjects, milestones, requirements, statuses, extras, totalHours: 1148 });

  it("total integralizado soma contribuições LIMITADAS ao mínimo (excedente não adianta)", () => {
    // NC: raw 200 / min 100 -> conta 100 · NEO: raw 100 / min 500 -> conta 100
    // NL: raw 128 / min 128 -> conta 128 · OPT 0 · AC 0  => 328 (não 428)
    expect(r.totals.hours).toBe(328);
  });

  it("barra trava em 100% mas o valor REAL e o excedente ficam registrados (RF-05)", () => {
    const nc = r.compositions.find(c => c.key === "NC")!;
    expect(nc.hours).toBe(200); // valor real preservado
    expect(nc.pct).toBe(100);   // exibição capada
    expect(nc.over).toBe(100);  // +100h além do mínimo
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

  it("marcos usam o total LIMITADO: oficial 328 não cruza CH1(400); projeção 428 cruza CH1 e não CH2", () => {
    const m = new Map(r.milestones.map(x => [x.key, x.reached]));
    expect(m.get("CH1")).toBe(false); // 328 < 400 (antes da regra do teto seria 428)
    expect(m.get("CH2")).toBe(false);
    // projetado: + optativa simulada (100h OPT, min 320 -> conta 100) => 428
    expect(r.projected.totals.hours).toBe(428);
    expect(r.projected.milestones.CH1).toBe(true);
    expect(r.projected.milestones.CH2).toBe(false);
  });
});

describe("recommend", () => {
  it("ranqueia disponíveis por destravamento (obrigatórias primeiro)", () => {
    const recs = recommend({ subjects, milestones, requirements, statuses });
    const seqs = recs.map(r => r.seq);
    expect(seqs).toContain(4); // avail
    expect(seqs).not.toContain(1); // já aprovada
    expect(seqs).not.toContain(2); // já aprovada
  });
});
