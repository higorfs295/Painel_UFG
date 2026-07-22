// Catálogo de cursos e a LIXEIRA (RF-28).
//
// Apagar um curso é destrutivo de verdade: leva junto matrículas, status, notas, extras e
// cenários de todos os alunos. Por isso a exclusão tem duas etapas:
//
//   1. mover para a lixeira (`deletedAt`) — reversível, invisível no catálogo, dados intactos;
//   2. expurgo definitivo — manual pelo admin ou automático depois de RETENTION_DAYS.
//
// A confirmação dupla é exigida no SERVIDOR (o cliente precisa reenviar o slug), não só na UI:
// um clique acidental, um script ou um `curl` distraído não apagam nada.
import type { PrismaClient } from "@prisma/client";
import { badRequest, notFound } from "../../lib/errors.js";
import { invalidateCourseGraph } from "../../domain/loadCourse.js";

/** Janela de arrependimento antes do expurgo automático. */
export const RETENTION_DAYS = 7;

const cutoff = () => new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

/** Catálogo visível: nunca inclui cursos na lixeira. */
export function listActiveCourses(prisma: PrismaClient) {
  return prisma.course.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true, totalHours: true },
    orderBy: { name: "asc" },
  });
}

/** O que um expurgo levaria junto — mostrado ao admin ANTES de confirmar. */
export async function courseImpact(prisma: PrismaClient, courseId: string) {
  const [enrollments, subjects] = await Promise.all([
    prisma.enrollment.count({ where: { courseId } }),
    prisma.subject.count({ where: { courseId } }),
  ]);
  const statuses = enrollments === 0 ? 0 : await prisma.subjectStatus.count({
    where: { enrollment: { courseId } },
  });
  return { enrollments, subjects, statuses };
}

/**
 * Etapa 1 — move para a lixeira. Exige `confirmSlug` idêntico ao slug do curso.
 * Idempotente: mover um curso já na lixeira não muda a data original (não reinicia o prazo).
 */
export async function trashCourse(prisma: PrismaClient, slug: string, confirmSlug: string) {
  const course = await prisma.course.findUnique({
    where: { slug }, select: { id: true, slug: true, name: true, deletedAt: true },
  });
  if (!course) throw notFound("curso não encontrado");
  if (confirmSlug !== slug)
    throw badRequest("confirmação inválida: reenvie o slug exato do curso para confirmar");

  if (course.deletedAt) return { ...course, alreadyTrashed: true };

  const impact = await courseImpact(prisma, course.id);
  const updated = await prisma.course.update({
    where: { id: course.id },
    data: { deletedAt: new Date() },
    select: { id: true, slug: true, name: true, deletedAt: true },
  });
  invalidateCourseGraph(course.id); // some do cache de grafo imediatamente
  return { ...updated, alreadyTrashed: false, impact };
}

/** Lista a lixeira com o prazo restante de cada curso. */
export async function listTrash(prisma: PrismaClient) {
  const rows = await prisma.course.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, slug: true, name: true, totalHours: true, deletedAt: true },
    orderBy: { deletedAt: "asc" },
  });
  const limit = cutoff().getTime();
  return rows.map((c) => {
    const deletedMs = c.deletedAt!.getTime();
    const msLeft = deletedMs - limit;               // quanto falta para cruzar o corte
    return {
      ...c,
      purgeAt: new Date(deletedMs + RETENTION_DAYS * 864e5).toISOString(),
      daysLeft: Math.max(0, Math.ceil(msLeft / 864e5)),
      expired: msLeft <= 0,                          // já passou do prazo; o próximo job leva
    };
  });
}

/** Restaura da lixeira. */
export async function restoreCourse(prisma: PrismaClient, id: string) {
  const course = await prisma.course.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!course) throw notFound("curso não encontrado");
  if (!course.deletedAt) throw badRequest("este curso não está na lixeira");
  const restored = await prisma.course.update({
    where: { id }, data: { deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  invalidateCourseGraph(id);
  return restored;
}

/**
 * Etapa 2 — expurgo definitivo. Só vale para curso JÁ na lixeira (não há atalho de um passo)
 * e exige a confirmação do slug de novo.
 */
export async function purgeCourse(prisma: PrismaClient, id: string, confirmSlug: string) {
  const course = await prisma.course.findUnique({
    where: { id }, select: { id: true, slug: true, name: true, deletedAt: true },
  });
  if (!course) throw notFound("curso não encontrado");
  if (!course.deletedAt)
    throw badRequest("mova o curso para a lixeira antes de apagar definitivamente");
  if (confirmSlug !== course.slug)
    throw badRequest("confirmação inválida: reenvie o slug exato do curso para confirmar");

  const impact = await courseImpact(prisma, id);
  await prisma.course.delete({ where: { id } }); // cascade: subjects, requisitos, matrículas...
  invalidateCourseGraph(id);
  return { slug: course.slug, name: course.name, impact };
}

/**
 * Expurgo automático dos cursos que passaram do prazo. Chamado pelo agendador do servidor.
 * Devolve os slugs removidos para o log.
 */
export async function purgeExpiredCourses(prisma: PrismaClient): Promise<string[]> {
  const expired = await prisma.course.findMany({
    where: { deletedAt: { lt: cutoff() } },
    select: { id: true, slug: true },
  });
  for (const c of expired) {
    await prisma.course.delete({ where: { id: c.id } });
    invalidateCourseGraph(c.id);
  }
  return expired.map((c) => c.slug);
}
