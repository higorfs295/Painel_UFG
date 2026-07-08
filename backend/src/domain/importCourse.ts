// Importação idempotente de matriz (RF-13) — compartilhada entre o seed e POST /courses/import.
// Formato do JSON: { course:{slug,name}, totalHours, requirements[], milestones[], subjects[] }
// onde subject = { seq, code, name, hours, nucleus, groupOpt, pre:[seq|CHx], co:[seq|CHx] }.
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { invalidateCourseGraph } from "./loadCourse.js";

export const matrizSchema = z.object({
  course: z.object({ slug: z.string().min(1), name: z.string().min(1) }),
  totalHours: z.number().int().positive(),
  requirements: z.array(z.object({
    key: z.string().min(1), label: z.string().min(1), hours: z.number().int().min(0),
  })),
  milestones: z.array(z.object({
    key: z.string().min(1), hours: z.number().int().min(0), description: z.string(),
  })),
  subjects: z.array(z.object({
    seq: z.number().int().positive(),
    code: z.string(), name: z.string().min(1), hours: z.number().int().min(0),
    nucleus: z.enum(["NC", "NE"]), groupOpt: z.number().int().min(0).default(0),
    pre: z.array(z.union([z.number().int(), z.string()])).default([]),
    co: z.array(z.union([z.number().int(), z.string()])).default([]),
  })),
});
export type Matriz = z.infer<typeof matrizSchema>;

// Cria/atualiza o curso com composições, marcos, disciplinas e requisitos. Reexecutável.
// Roda em uma única transação (atomicidade: import parcial não deixa o curso inconsistente) e
// insere os requisitos em lote (createMany) em vez de um-a-um. Requisitos órfãos (seq inexistente
// na matriz) são ignorados — antes geravam linhas sem alvo nem milestone.
export async function importCourse(prisma: PrismaClient, raw: unknown) {
  const matriz = matrizSchema.parse(raw);

  const result = await prisma.$transaction(async (tx) => {
    const course = await tx.course.upsert({
      where: { slug: matriz.course.slug },
      update: { name: matriz.course.name, totalHours: matriz.totalHours },
      create: { slug: matriz.course.slug, name: matriz.course.name, totalHours: matriz.totalHours },
    });

    for (const r of matriz.requirements)
      await tx.compositionRequirement.upsert({
        where: { courseId_key: { courseId: course.id, key: r.key } },
        update: { label: r.label, hours: r.hours },
        create: { courseId: course.id, key: r.key, label: r.label, hours: r.hours },
      });

    for (const m of matriz.milestones)
      await tx.milestone.upsert({
        where: { courseId_key: { courseId: course.id, key: m.key } },
        update: { hours: m.hours, description: m.description },
        create: { courseId: course.id, key: m.key, hours: m.hours, description: m.description },
      });

    // duas passadas: disciplinas primeiro (para resolver requisitos por seq), depois requisitos em lote.
    const bySeq: Record<number, string> = {};
    for (const s of matriz.subjects) {
      const subj = await tx.subject.upsert({
        where: { courseId_seq: { courseId: course.id, seq: s.seq } },
        update: { code: s.code, name: s.name, hours: s.hours, nucleus: s.nucleus, groupOpt: s.groupOpt },
        create: {
          courseId: course.id, seq: s.seq, code: s.code, name: s.name,
          hours: s.hours, nucleus: s.nucleus, groupOpt: s.groupOpt,
        },
      });
      bySeq[s.seq] = subj.id;
    }

    // recria os requisitos do zero (idempotente) num único deleteMany + createMany
    await tx.requisite.deleteMany({ where: { subjectId: { in: Object.values(bySeq) } } });
    const reqRows: { subjectId: string; type: "PRE" | "CO"; requiresSubjectId?: string; milestoneKey?: string }[] = [];
    for (const s of matriz.subjects) {
      const subjectId = bySeq[s.seq];
      if (!subjectId) continue; // impossível na prática: acabou de ser upsertado acima
      for (const [list, type] of [[s.pre, "PRE"], [s.co, "CO"]] as const) {
        for (const r of list) {
          if (typeof r === "number") {
            const requiresSubjectId = bySeq[r];
            if (!requiresSubjectId) continue; // órfão: seq referenciado não existe na matriz
            reqRows.push({ subjectId, type, requiresSubjectId });
          } else {
            reqRows.push({ subjectId, type, milestoneKey: r });
          }
        }
      }
    }
    if (reqRows.length) await tx.requisite.createMany({ data: reqRows });

    return { slug: course.slug, subjects: matriz.subjects.length, courseId: course.id };
  }, { timeout: 30_000, maxWait: 10_000 });

  invalidateCourseGraph(result.courseId); // matriz mudou: derruba o cache do grafo
  return { slug: result.slug, subjects: result.subjects };
}
