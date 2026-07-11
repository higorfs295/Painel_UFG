// Popula: curso EngComp (matriz 2021.1 via importCourse), a conta ADMIN (painel@admin.com —
// administra, não cursa), as contas-aluno definidas em students.json (modelo padrão + a conta
// pessoal do Higor com a baseline auditada) e o calendário acadêmico global (RF-20 v2).
// Idempotente. Requer SEED_ADMIN_PASSWORD; SEED_STUDENT_PASSWORD é opcional (cai no admin).
// Para criar mais alunos conforme o desenvolvimento, basta adicionar objetos em students.json.
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { importCourse } from "../domain/importCourse.js";

const here = dirname(fileURLToPath(import.meta.url));
const readJson = (f: string) => JSON.parse(readFileSync(join(here, f), "utf-8"));
const matriz = readJson("matriz-engcomp-2021.json");
const studentsDoc = readJson("students.json");
const prisma = new PrismaClient();

const ADMIN = { name: "Administrador", email: "painel@admin.com" };

type Extra = { name: string; code?: string; ch: number; cat: string; status?: string; done?: boolean };
type Baseline = {
  courseSlug: string; startTerm?: string; matricula?: string; shift?: string;
  approvedSeq?: number[]; enrolledSeq?: number[]; extras?: Extra[];
};
type StudentDef = Baseline & { name: string; email: string; profile?: string };

async function seedStudent(def: StudentDef, hash: string) {
  // baseline vem de um JSON externo (profile) ou dos campos inline do próprio item
  const base: Baseline = def.profile
    ? { ...readJson(def.profile).enrollment, ...readJson(def.profile) as any }
    : def;
  const courseSlug = def.courseSlug ?? base.courseSlug ?? matriz.course.slug;
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: courseSlug } });
  const subjects = await prisma.subject.findMany({ where: { courseId: course.id }, select: { id: true, seq: true } });
  const idBySeq = new Map(subjects.map((s) => [s.seq, s.id]));

  const user = await prisma.user.upsert({
    where: { email: def.email },
    update: { name: def.name, role: "USER", ...(def.matricula ? { matricula: def.matricula } : {}), ...(def.shift ? { shift: def.shift } : {}) },
    create: {
      name: def.name, email: def.email, role: "USER", passwordHash: hash,
      matricula: def.matricula ?? null, shift: def.shift ?? null,
    },
  });

  const enr = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    update: { startTerm: base.startTerm ?? null },
    create: { userId: user.id, courseId: course.id, startTerm: base.startTerm ?? null },
  });

  const mark = async (seqs: number[] | undefined, state: "APPROVED" | "ENROLLED") => {
    for (const seq of seqs ?? []) {
      const subjectId = idBySeq.get(seq);
      if (!subjectId) { console.warn(`  seq ${seq} não existe na matriz — ignorada`); continue; }
      await prisma.subjectStatus.upsert({
        where: { enrollmentId_subjectId: { enrollmentId: enr.id, subjectId } },
        update: { state }, create: { enrollmentId: enr.id, subjectId, state },
      });
    }
  };
  await mark(base.approvedSeq, "APPROVED");
  await mark(base.enrolledSeq, "ENROLLED");

  for (const x of base.extras ?? []) {
    const existing = await prisma.extraComponent.findFirst({ where: { enrollmentId: enr.id, name: x.name } });
    const status = (x.status ?? (x.done === false ? "PLANNED" : "DONE")) as any; // aceita status ou done legado
    const data = { enrollmentId: enr.id, name: x.name, code: x.code || null, hours: x.ch, category: x.cat as any, status };
    if (existing) await prisma.extraComponent.update({ where: { id: existing.id }, data });
    else await prisma.extraComponent.create({ data });
  }

  return { email: user.email, aprovadas: (base.approvedSeq ?? []).length };
}

async function main() {
  const pwd = process.env.SEED_ADMIN_PASSWORD;
  if (!pwd || pwd.length < 10) throw new Error("Defina SEED_ADMIN_PASSWORD (>=10 caracteres).");
  const studentPwd = process.env.SEED_STUDENT_PASSWORD || pwd;
  if (studentPwd.length < 10) throw new Error("SEED_STUDENT_PASSWORD precisa de >=10 caracteres.");
  const [adminHash, studentHash] = await Promise.all([argon2.hash(pwd), argon2.hash(studentPwd)]);

  // 1) curso + matriz (mesmo caminho de POST /courses/import — RF-13)
  await importCourse(prisma, matriz);

  // 2) ADMIN — sem matrícula (gerencia o sistema, não cursa). Senha trocável em /me/password.
  const admin = await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { role: "ADMIN" },
    create: { name: ADMIN.name, email: ADMIN.email, role: "ADMIN", passwordHash: adminHash },
  });
  await prisma.enrollment.deleteMany({ where: { userId: admin.id } });

  // 3) contas-aluno definidas em students.json (extensível)
  const results = [];
  for (const def of studentsDoc.students as StudentDef[]) {
    results.push(await seedStudent(def, studentHash));
  }

  // 4) calendário acadêmico global — só quando vazio (não sobrescreve agendamentos do admin).
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

  console.log("Seed ok:", { admin: admin.email, alunos: results });
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
