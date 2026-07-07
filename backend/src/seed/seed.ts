// Popula: curso EngComp (matriz 2021.1 completa via importCourse) e a conta do Higor com a
// baseline auditada do extrato (RF-14). Idempotente. Requer SEED_ADMIN_PASSWORD no ambiente.
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { importCourse } from "../domain/importCourse.js";

const here = dirname(fileURLToPath(import.meta.url));
const matriz = JSON.parse(readFileSync(join(here, "matriz-engcomp-2021.json"), "utf-8"));
const perfil = JSON.parse(readFileSync(join(here, "perfil-higor.json"), "utf-8"));
const prisma = new PrismaClient();

async function main() {
  const pwd = process.env.SEED_ADMIN_PASSWORD;
  if (!pwd || pwd.length < 10) throw new Error("Defina SEED_ADMIN_PASSWORD (>=10 caracteres).");

  // 1) curso + matriz (mesmo caminho de código de POST /courses/import — RF-13)
  await importCourse(prisma, matriz);
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: matriz.course.slug } });
  const subjects = await prisma.subject.findMany({ where: { courseId: course.id }, select: { id: true, seq: true } });
  const idBySeq = new Map(subjects.map(s => [s.seq, s.id]));

  // 2) usuário admin (Higor) — senha via env, nunca versionada
  const user = await prisma.user.upsert({
    where: { email: perfil.user.email },
    update: {},
    create: {
      name: perfil.user.name, email: perfil.user.email, role: perfil.user.role,
      passwordHash: await argon2.hash(pwd),
    },
  });

  // 3) enrollment
  const enr = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    update: { startTerm: perfil.enrollment.startTerm, currentTerm: perfil.enrollment.currentTerm },
    create: {
      userId: user.id, courseId: course.id,
      startTerm: perfil.enrollment.startTerm, currentTerm: perfil.enrollment.currentTerm,
    },
  });

  // 4) disciplinas aprovadas (baseline auditada)
  for (const seq of perfil.approvedSeq as number[]) {
    const subjectId = idBySeq.get(seq);
    if (!subjectId) { console.warn(`seq ${seq} não existe na matriz — ignorada`); continue; }
    await prisma.subjectStatus.upsert({
      where: { enrollmentId_subjectId: { enrollmentId: enr.id, subjectId } },
      update: { state: "APPROVED" },
      create: { enrollmentId: enr.id, subjectId, state: "APPROVED" },
    });
  }

  // 5) componentes extras (NL, AC, registros). Idempotente por (enrollment, name).
  for (const x of perfil.extras as any[]) {
    const existing = await prisma.extraComponent.findFirst({
      where: { enrollmentId: enr.id, name: x.name },
    });
    const data = {
      enrollmentId: enr.id, name: x.name, code: x.code || null,
      hours: x.ch, category: x.cat, done: x.done,
    };
    if (existing) await prisma.extraComponent.update({ where: { id: existing.id }, data });
    else await prisma.extraComponent.create({ data });
  }

  console.log("Seed ok:", { course: course.slug, user: user.email, aprovadas: perfil.approvedSeq.length });
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
