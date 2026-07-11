// Popula: curso EngComp (matriz 2021.1 completa via importCourse), a conta ADMIN (sem matrícula
// — admin administra, não cursa), a conta-aluno de demonstração com a baseline auditada do
// extrato (RF-14) e o calendário acadêmico global (RF-20 v2). Idempotente.
// Requer SEED_ADMIN_PASSWORD no ambiente (usada nas duas contas).
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

const STUDENT_EMAIL = "aluno@painel.local";

async function main() {
  const pwd = process.env.SEED_ADMIN_PASSWORD;
  if (!pwd || pwd.length < 10) throw new Error("Defina SEED_ADMIN_PASSWORD (>=10 caracteres).");
  const hash = await argon2.hash(pwd);

  // 1) curso + matriz (mesmo caminho de código de POST /courses/import — RF-13)
  await importCourse(prisma, matriz);
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: matriz.course.slug } });
  const subjects = await prisma.subject.findMany({ where: { courseId: course.id }, select: { id: true, seq: true } });
  const idBySeq = new Map(subjects.map(s => [s.seq, s.id]));

  // 2) conta ADMIN — sem matrícula em curso algum (gerencia o sistema, não cursa)
  const admin = await prisma.user.upsert({
    where: { email: perfil.user.email },
    update: { role: "ADMIN" },
    create: { name: perfil.user.name, email: perfil.user.email, role: "ADMIN", passwordHash: hash },
  });
  await prisma.enrollment.deleteMany({ where: { userId: admin.id } }); // migra instâncias antigas

  // 3) conta-aluno de demonstração — recebe a baseline auditada (antes ficava no admin)
  const student = await prisma.user.upsert({
    where: { email: STUDENT_EMAIL },
    update: {},
    create: { name: "Aluno de Demonstração", email: STUDENT_EMAIL, role: "USER", passwordHash: hash },
  });

  const enr = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    update: { startTerm: perfil.enrollment.startTerm },
    create: { userId: student.id, courseId: course.id, startTerm: perfil.enrollment.startTerm },
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

  // 6) calendário acadêmico global — só quando vazio (não sobrescreve agendamentos do admin).
  // Exemplo real: 2026.1 em curso -> 06/07 começam as férias -> 10/08 começa o 2026.2.
  if ((await prisma.academicPeriod.count()) === 0) {
    await prisma.academicPeriod.createMany({
      data: [
        { type: "TERM", term: "2026.1", startsAt: new Date("2026-03-09T00:00:00-03:00") },
        { type: "BREAK", term: null, startsAt: new Date("2026-07-06T00:00:00-03:00") },
        { type: "TERM", term: "2026.2", startsAt: new Date("2026-08-10T00:00:00-03:00") },
      ],
    });
  }

  console.log("Seed ok:", {
    course: course.slug, admin: admin.email, aluno: student.email,
    aprovadas: perfil.approvedSeq.length,
  });
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
