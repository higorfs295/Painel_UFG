// Grafo da matriz no cliente — alimenta o Mapa curricular e a gaveta de disciplina.
//
// A fonte de verdade do STATUS (concluída/disponível/bloqueada) continua sendo o servidor
// (`/progress`); aqui só se monta a TOPOLOGIA a partir do detalhe do curso, para
// responder "o que esta disciplina exige" e "o que ela libera". A matriz tem ~120 nós,
// então percorrer tudo em memória a cada seleção custa nada.
import type { CourseDetail, CourseSubject } from "@/lib/api/endpoints";

export type Edge = { from: number; to: number; type: "PRE" | "CO" };

export type CurriculumGraph = {
  bySeq: Map<number, CourseSubject>;
  /** seq → requisitos diretos (disciplinas) */
  requires: Map<number, Edge[]>;
  /** seq → disciplinas que dependem diretamente desta */
  unlocks: Map<number, Edge[]>;
  /** seq → marcos de horas exigidos (CH1, CH2…) */
  milestones: Map<number, string[]>;
  /** seq → profundidade = maior cadeia de pré-requisitos até ela (0 = sem requisito) */
  depth: Map<number, number>;
  maxDepth: number;
};

export function buildGraph(course: CourseDetail): CurriculumGraph {
  const bySeq = new Map<number, CourseSubject>();
  const seqById = new Map<string, number>();
  for (const s of course.subjects) { bySeq.set(s.seq, s); seqById.set(s.id, s.seq); }

  const requires = new Map<number, Edge[]>();
  const unlocks = new Map<number, Edge[]>();
  const milestones = new Map<number, string[]>();

  for (const s of course.subjects) {
    for (const r of s.requires ?? []) {
      if (r.milestoneKey) {
        milestones.set(s.seq, [...(milestones.get(s.seq) ?? []), r.milestoneKey]);
        continue;
      }
      const from = r.requiresSubjectId ? seqById.get(r.requiresSubjectId) : undefined;
      if (from === undefined) continue;
      const e: Edge = { from, to: s.seq, type: r.type };
      requires.set(s.seq, [...(requires.get(s.seq) ?? []), e]);
      unlocks.set(from, [...(unlocks.get(from) ?? []), e]);
    }
  }

  // profundidade pela maior cadeia de PRÉ-requisitos (co-requisito anda junto, não empurra
  // a camada). Memoizado e protegido contra ciclo — uma matriz mal importada não trava a tela.
  const depth = new Map<number, number>();
  const visiting = new Set<number>();
  const depthOf = (seq: number): number => {
    const known = depth.get(seq);
    if (known !== undefined) return known;
    if (visiting.has(seq)) return 0;
    visiting.add(seq);
    const pres = (requires.get(seq) ?? []).filter((e) => e.type === "PRE");
    const d = pres.length ? 1 + Math.max(...pres.map((e) => depthOf(e.from))) : 0;
    visiting.delete(seq);
    depth.set(seq, d);
    return d;
  };
  for (const seq of bySeq.keys()) depthOf(seq);

  return { bySeq, requires, unlocks, milestones, depth, maxDepth: Math.max(0, ...depth.values()) };
}

/** Todos os ancestrais (o que precisa vir antes) ou descendentes (o que vem depois). */
export function closure(g: CurriculumGraph, seq: number, dir: "up" | "down"): Set<number> {
  const out = new Set<number>();
  const stack = [seq];
  while (stack.length) {
    const cur = stack.pop()!;
    const edges = dir === "up" ? g.requires.get(cur) : g.unlocks.get(cur);
    for (const e of edges ?? []) {
      const next = dir === "up" ? e.from : e.to;
      if (!out.has(next)) { out.add(next); stack.push(next); }
    }
  }
  return out;
}
