import { describe, it, expect } from "vitest";
import { statusOf, buildDeps, unlockCount, type Subject, type Milestone } from "../../src/domain/graph.js";

// matriz mínima:
//  1 (obrig, sem req)  -> pré de 2
//  2 (obrig, pré=1)    -> pré de 3
//  3 (obrig, pré=2)
//  4 (obrig, co=1)     -> co-requisito
//  5 (obrig, pré=CH1 1200h)
const S = (over: Partial<Subject> & { seq: number }): Subject => ({
  code: `C${over.seq}`, name: `Disc ${over.seq}`, hours: 64, nucleus: "NE", groupOpt: 0,
  pre: [], co: [], ...over,
});
const subjects: Subject[] = [
  S({ seq: 1 }),
  S({ seq: 2, pre: [1] }),
  S({ seq: 3, pre: [2] }),
  S({ seq: 4, co: [1] }),
  S({ seq: 5, pre: ["CH1"] }),
];
const milestones: Milestone[] = [{ key: "CH1", hours: 1200, description: "marco" }];
const bySeq = new Map(subjects.map(s => [s.seq, s]));

describe("statusOf", () => {
  it("done quando aprovada", () => {
    expect(statusOf(S({ seq: 1 }), new Set([1]), 0, milestones, bySeq)).toBe("done");
  });
  it("avail quando sem pré/co pendentes", () => {
    expect(statusOf(subjects[0], new Set(), 0, milestones, bySeq)).toBe("avail");
  });
  it("lock quando falta pré-requisito", () => {
    expect(statusOf(subjects[1], new Set(), 0, milestones, bySeq)).toBe("lock");
  });
  it("co quando só falta co-requisito destravado", () => {
    expect(statusOf(subjects[3], new Set(), 0, milestones, bySeq)).toBe("co");
  });
  it("marco por horas: lock abaixo, avail no limiar", () => {
    expect(statusOf(subjects[4], new Set(), 1199, milestones, bySeq)).toBe("lock");
    expect(statusOf(subjects[4], new Set(), 1200, milestones, bySeq)).toBe("avail");
  });
});

describe("unlockCount", () => {
  it("conta destravamentos transitivos (obrigatórias)", () => {
    const deps = buildDeps(subjects);
    // aprovar 1 destrava 2 e 4 diretos; 2 destrava 3 => transitivo {2,3,4}
    const { ob, tot } = unlockCount(1, deps, new Set(), bySeq);
    expect(tot).toBe(3);
    expect(ob).toBe(3);
  });
  it("não conta já aprovadas", () => {
    const deps = buildDeps(subjects);
    const { tot } = unlockCount(1, deps, new Set([2, 3]), bySeq);
    expect(tot).toBe(1); // só 4 continua pendente
  });
});
