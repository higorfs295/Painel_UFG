// Ponte Prisma -> formas puras do domínio (graph/progress). Carrega o curso uma vez e monta
// as disciplinas com pre/co já resolvidos por seq ou milestoneKey.
import type { PrismaClient } from "@prisma/client";
import type { Subject, Milestone } from "./graph.js";
import type { Requirement } from "./sums.js";

export type CourseGraph = {
  courseId: string;
  totalHours: number;
  subjects: Subject[];
  milestones: Milestone[];
  requirements: Requirement[];
};

// Cache em memória do grafo do curso (imutável entre importações). Overview dispara progress +
// recommendations, que antes recarregavam o curso inteiro 2x por request. TTL curto limita a
// staleness entre réplicas; toda mutação de matriz chama invalidateCourseGraph().
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; graph: CourseGraph }>();

export function invalidateCourseGraph(courseId?: string) {
  if (courseId) cache.delete(courseId);
  else cache.clear();
}

export async function loadCourseGraph(prisma: PrismaClient, courseId: string): Promise<CourseGraph | null> {
  const hit = cache.get(courseId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.graph;

  const graph = await loadCourseGraphUncached(prisma, courseId);
  if (graph) cache.set(courseId, { at: Date.now(), graph });
  return graph;
}

async function loadCourseGraphUncached(prisma: PrismaClient, courseId: string): Promise<CourseGraph | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      requirements: true,
      milestones: true,
      subjects: { include: { requires: true }, orderBy: { seq: "asc" } },
    },
  });
  if (!course) return null;

  const seqById = new Map(course.subjects.map(s => [s.id, s.seq]));

  const subjects: Subject[] = course.subjects.map(s => {
    const pre: (number | string)[] = [];
    const co: (number | string)[] = [];
    for (const r of s.requires) {
      const ref: number | string | undefined =
        r.requiresSubjectId != null ? seqById.get(r.requiresSubjectId) : r.milestoneKey ?? undefined;
      if (ref === undefined) continue; // requisito órfão (disciplina removida) — ignora
      (r.type === "PRE" ? pre : co).push(ref);
    }
    // Nucleus do schema é "NC" | "NE"; o domínio usa a mesma convenção.
    return {
      seq: s.seq, code: s.code, name: s.name, hours: s.hours,
      nucleus: s.nucleus as "NC" | "NE", groupOpt: s.groupOpt, pre, co,
    };
  });

  return {
    courseId: course.id,
    totalHours: course.totalHours,
    subjects,
    milestones: course.milestones.map(m => ({ key: m.key, hours: m.hours, description: m.description })),
    requirements: course.requirements.map(r => ({ key: r.key, label: r.label, hours: r.hours })),
  };
}
