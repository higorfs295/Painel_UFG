// RF-16 — export/import do backup JSON do próprio usuário. Portável por curso: as disciplinas
// são referenciadas por `seq` (não por id), então o backup sobrevive a re-seed/reimportação da matriz.
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const BACKUP_VERSION = 1;

export const backupSchema = z.object({
  version: z.number().int(),
  exportedAt: z.string().optional(),
  user: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    theme: z.enum(["dark", "light"]).optional(),
  }),
  enrollments: z.array(z.object({
    courseSlug: z.string(),
    startTerm: z.string().nullable().optional(),
    currentTerm: z.string().nullable().optional(),
    subjects: z.array(z.object({
      seq: z.number().int(),
      state: z.enum(["APPROVED", "SIMULATED", "ENROLLED"]),
      // RF-22 — histórico: opcionais para manter compatibilidade com backups antigos
      term: z.string().nullish(),
      grade: z.number().min(0).max(10).nullish(),
      absences: z.number().int().min(0).nullish(),
    })).default([]),
    extras: z.array(z.object({
      name: z.string(), code: z.string().nullable().optional(),
      hours: z.number().int().min(0), category: z.enum(["NC", "NE", "OPT", "NL", "AC", "NONE"]),
      status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]).optional(),
      done: z.boolean().optional(), // legado: backups antigos traziam done em vez de status
    })).default([]),
    scenarios: z.array(z.object({
      name: z.string(),
      disciplines: z.array(z.object({
        name: z.string(), sigla: z.string(), hours: z.number().int().min(0),
        docente: z.string().nullable().optional(), sigaaCode: z.string().default(""), color: z.string(),
      })).default([]),
      paints: z.array(z.object({ cellKey: z.string(), category: z.string() })).default([]),
    })).default([]),
  })).default([]),
});
export type Backup = z.infer<typeof backupSchema>;

// Monta o backup completo dos dados do usuário.
export async function exportUser(prisma: PrismaClient, userId: string): Promise<Backup> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId }, select: { name: true, email: true, theme: true },
  });
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: { select: { slug: true } },
      statuses: { include: { subject: { select: { seq: true } } } },
      extras: true,
      scenarios: { include: { disciplines: true, paints: true } },
    },
  });
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user: { name: user.name, email: user.email, theme: user.theme as "dark" | "light" },
    enrollments: enrollments.map(e => ({
      courseSlug: e.course.slug,
      startTerm: e.startTerm,
      currentTerm: e.currentTerm,
      subjects: e.statuses.map(s => ({
        seq: s.subject.seq, state: s.state, term: s.term, grade: s.grade, absences: s.absences,
      })),
      extras: e.extras.map(x => ({
        name: x.name, code: x.code, hours: x.hours, category: x.category, status: x.status,
      })),
      scenarios: e.scenarios.map(sc => ({
        name: sc.name,
        disciplines: sc.disciplines.map(d => ({
          name: d.name, sigla: d.sigla, hours: d.hours, docente: d.docente,
          sigaaCode: d.sigaaCode, color: d.color,
        })),
        paints: sc.paints.map(p => ({ cellKey: p.cellKey, category: p.category })),
      })),
    })),
  };
}

// Restaura um backup no usuário. Para cada enrollment presente (casado por courseSlug), SUBSTITUI
// statuses/extras/cenários pelos do backup. Cursos inexistentes no servidor são ignorados (reportados).
export async function importUser(prisma: PrismaClient, userId: string, raw: unknown) {
  const data = backupSchema.parse(raw);
  const skippedCourses: string[] = [];
  let restored = 0;

  await prisma.$transaction(async (tx) => {
    if (data.user.theme) await tx.user.update({ where: { id: userId }, data: { theme: data.user.theme } });

    for (const enr of data.enrollments) {
      const course = await tx.course.findUnique({ where: { slug: enr.courseSlug } });
      if (!course) { skippedCourses.push(enr.courseSlug); continue; }

      const enrollment = await tx.enrollment.upsert({
        where: { userId_courseId: { userId, courseId: course.id } },
        update: { startTerm: enr.startTerm ?? null, currentTerm: enr.currentTerm ?? null },
        create: { userId, courseId: course.id, startTerm: enr.startTerm ?? null, currentTerm: enr.currentTerm ?? null },
      });

      const subs = await tx.subject.findMany({ where: { courseId: course.id }, select: { id: true, seq: true } });
      const idBySeq = new Map(subs.map(s => [s.seq, s.id]));

      // substitui status
      await tx.subjectStatus.deleteMany({ where: { enrollmentId: enrollment.id } });
      for (const st of enr.subjects) {
        const sid = idBySeq.get(st.seq);
        if (sid) await tx.subjectStatus.create({
          data: {
            enrollmentId: enrollment.id, subjectId: sid, state: st.state,
            term: st.term ?? null, grade: st.grade ?? null, absences: st.absences ?? null,
          },
        });
      }

      // substitui extras
      await tx.extraComponent.deleteMany({ where: { enrollmentId: enrollment.id } });
      for (const x of enr.extras)
        await tx.extraComponent.create({
          data: {
            enrollmentId: enrollment.id, name: x.name, code: x.code ?? null, hours: x.hours,
            category: x.category,
            // status novo; se vier de backup legado, deriva de `done`
            status: x.status ?? (x.done === false ? "PLANNED" : "DONE"),
          },
        });

      // substitui cenários (cascade remove disciplinas/pinturas antigas)
      await tx.scenario.deleteMany({ where: { enrollmentId: enrollment.id } });
      for (const sc of enr.scenarios)
        await tx.scenario.create({
          data: {
            enrollmentId: enrollment.id, name: sc.name,
            disciplines: { create: sc.disciplines.map(d => ({ ...d, docente: d.docente ?? null })) },
            paints: { create: sc.paints },
          },
        });

      restored++;
    }
  });

  return { restored, skippedCourses };
}
