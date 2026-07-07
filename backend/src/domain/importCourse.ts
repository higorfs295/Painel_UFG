// Importação idempotente de matriz (RF-13) — compartilhada entre o seed e POST /courses/import.
// Formato do JSON: { course:{slug,name}, totalHours, requirements[], milestones[], subjects[] }
// onde subject = { seq, code, name, hours, nucleus, groupOpt, pre:[seq|CHx], co:[seq|CHx] }.
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

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
export async function importCourse(prisma: PrismaClient, raw: unknown) {
  const matriz = matrizSchema.parse(raw);

  const course = await prisma.course.upsert({
    where: { slug: matriz.course.slug },
    update: { name: matriz.course.name, totalHours: matriz.totalHours },
    create: { slug: matriz.course.slug, name: matriz.course.name, totalHours: matriz.totalHours },
  });

  for (const r of matriz.requirements)
    await prisma.compositionRequirement.upsert({
      where: { courseId_key: { courseId: course.id, key: r.key } },
      update: { label: r.label, hours: r.hours },
      create: { courseId: course.id, key: r.key, label: r.label, hours: r.hours },
    });

  for (const m of matriz.milestones)
    await prisma.milestone.upsert({
      where: { courseId_key: { courseId: course.id, key: m.key } },
      update: { hours: m.hours, description: m.description },
      create: { courseId: course.id, key: m.key, hours: m.hours, description: m.description },
    });

  // duas passadas: disciplinas primeiro (para resolver requisitos por seq), depois requisitos.
  const bySeq: Record<number, string> = {};
  for (const s of matriz.subjects) {
    const subj = await prisma.subject.upsert({
      where: { courseId_seq: { courseId: course.id, seq: s.seq } },
      update: { code: s.code, name: s.name, hours: s.hours, nucleus: s.nucleus, groupOpt: s.groupOpt },
      create: {
        courseId: course.id, seq: s.seq, code: s.code, name: s.name,
        hours: s.hours, nucleus: s.nucleus, groupOpt: s.groupOpt,
      },
    });
    bySeq[s.seq] = subj.id;
  }

  for (const s of matriz.subjects) {
    // recria requisitos da disciplina do zero (idempotência sem duplicar linhas)
    await prisma.requisite.deleteMany({ where: { subjectId: bySeq[s.seq] } });
    for (const [list, type] of [[s.pre, "PRE"], [s.co, "CO"]] as const) {
      for (const r of list) {
        await prisma.requisite.create({
          data: {
            subjectId: bySeq[s.seq], type,
            ...(typeof r === "number"
              ? { requiresSubjectId: bySeq[r] ?? undefined }
              : { milestoneKey: r }),
          },
        });
      }
    }
  }

  return { slug: course.slug, subjects: matriz.subjects.length };
}
