// Popula: curso EngComp (matriz 2021.1 completa), usuário admin Higor (perfil populado — RF-14)
// Requer SEED_ADMIN_PASSWORD no ambiente para não versionar senha.
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const matriz = JSON.parse(readFileSync(join(here, "matriz-engcomp-2021.json"), "utf-8"));
const perfil = JSON.parse(readFileSync(join(here, "perfil-higor.json"), "utf-8"));
const prisma = new PrismaClient();

async function main() {
  const pwd = process.env.SEED_ADMIN_PASSWORD;
  if (!pwd || pwd.length < 10) throw new Error("Defina SEED_ADMIN_PASSWORD (>=10 caracteres).");

  const course = await prisma.course.upsert({
    where: { slug: matriz.course.slug },
    update: {},
    create: {
      slug: matriz.course.slug, name: matriz.course.name, totalHours: matriz.totalHours,
      requirements: { create: matriz.requirements },
      milestones:   { create: matriz.milestones },
    },
  });

  // disciplinas (2 passadas: criar todas, depois requisitos por seq)
  const bySeq: Record<number, string> = {};
  for (const s of matriz.subjects) {
    const subj = await prisma.subject.upsert({
      where: { courseId_seq: { courseId: course.id, seq: s.seq } },
      update: {},
      create: { courseId: course.id, seq: s.seq, code: s.code, name: s.name,
        hours: s.hours, nucleus: s.nucleus, groupOpt: s.groupOpt },
    });
    bySeq[s.seq] = subj.id;
  }
  for (const s of matriz.subjects) {
    for (const [list, type] of [[s.pre, "PRE"], [s.co, "CO"]] as const) {
      for (const r of list) {
        await prisma.requisite.create({ data: {
          subjectId: bySeq[s.seq], type,
          ...(typeof r === "number" ? { requiresSubjectId: bySeq[r] } : { milestoneKey: r }),
        }});
      }
    }
  }

  const user = await prisma.user.upsert({
    where: { email: perfil.user.email },
    update: {},
    create: { name: perfil.user.name, email: perfil.user.email, role: perfil.user.role,
      passwordHash: await argon2.hash(pwd) },
  });
  const enr = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    update: {},
    create: { userId: user.id, courseId: course.id,
      startTerm: perfil.enrollment.startTerm, currentTerm: perfil.enrollment.currentTerm },
  });
  for (const seq of perfil.approvedSeq)
    await prisma.subjectStatus.upsert({
      where: { enrollmentId_subjectId: { enrollmentId: enr.id, subjectId: bySeq[seq] } },
      update: { state: "APPROVED" },
      create: { enrollmentId: enr.id, subjectId: bySeq[seq], state: "APPROVED" },
    });
  for (const x of perfil.extras)
    await prisma.extraComponent.create({ data: {
      enrollmentId: enr.id, name: x.name, code: x.code || null,
      hours: x.ch, category: x.cat, done: x.done } });

  console.log("Seed ok:", { course: course.slug, user: user.email });
}
main().finally(() => prisma.$disconnect());
