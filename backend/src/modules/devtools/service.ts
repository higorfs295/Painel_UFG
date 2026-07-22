// Geração de massa de dados realista (uso exclusivo de desenvolvimento).
// Fica fora das rotas para que o handler seja só "valida → chama → responde", e para que a
// heurística de plausibilidade (prefixo da grade, notas, agenda) possa evoluir isolada.
import type { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { encryptField } from "../../lib/fieldCrypto.js";
import { badRequest } from "../../lib/errors.js";

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabi", "Heitor", "Isis", "João",
  "Karina", "Lucas", "Marina", "Nathan", "Olívia", "Pedro", "Rafa", "Sofia", "Tiago", "Vitória"];
const LAST = ["Almeida", "Barbosa", "Carvalho", "Dias", "Esteves", "Ferreira", "Gomes", "Henriques",
  "Ibrahim", "Junqueira", "Lima", "Moreira", "Nunes", "Oliveira", "Pereira", "Queiroz", "Rocha", "Souza"];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export type SeedStudentsInput = {
  count: number; courseSlug: string; password: string; progress: number;
};

/** Cria N alunos fictícios com progresso, notas e agenda plausíveis. Devolve os e-mails criados. */
export async function seedFakeStudents(
  prisma: PrismaClient,
  input: SeedStudentsInput,
): Promise<string[]> {
  const course = await prisma.course.findUnique({
    where: { slug: input.courseSlug }, select: { id: true },
  });
  if (!course) throw badRequest("curso inexistente");

  const subjects = await prisma.subject.findMany({
    where: { courseId: course.id }, orderBy: { seq: "asc" }, select: { id: true },
  });
  if (subjects.length === 0) throw badRequest("curso sem disciplinas");

  const hash = await argon2.hash(input.password); // um hash só: argon2 é caro de propósito
  const stamp = Date.now().toString(36);
  const emails: string[] = [];

  for (let i = 0; i < input.count; i++) {
    const email = `dev.${stamp}${i}@dev.local`;
    const startYear = rand(2019, 2024);

    // aprova um PREFIXO da grade: como a matriz está em ordem de período, o resultado
    // respeita pré-requisitos sem precisar resolver o grafo.
    const spread = 0.7 + Math.random() * 0.6;
    const approvedCount = Math.min(subjects.length, Math.floor(subjects.length * input.progress * spread));
    const approved = subjects.slice(0, approvedCount);
    const enrolling = subjects.slice(approvedCount, approvedCount + rand(1, 2));

    // uma transação por aluno: ou o aluno nasce inteiro, ou não nasce
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: `${pick(FIRST)} ${pick(LAST)}`, email, role: "USER", passwordHash: hash,
          matricula: encryptField(`${rand(2019, 2025)}${rand(100000, 999999)}`),
          shift: pick(["matutino", "vespertino", "noturno", "integral"]),
        },
        select: { id: true },
      });
      const enr = await tx.enrollment.create({
        data: { userId: user.id, courseId: course.id, startTerm: `${startYear}.${rand(1, 2)}` },
        select: { id: true },
      });

      if (approved.length) {
        await tx.subjectStatus.createMany({
          data: approved.map((s, idx) => ({
            enrollmentId: enr.id, subjectId: s.id, state: "APPROVED" as const,
            term: `${startYear + Math.floor(idx / 6)}.${(idx % 2) + 1}`,
            grade: Math.round((5 + Math.random() * 5) * 10) / 10,
            absences: rand(0, 12),
          })),
        });
      }
      if (enrolling.length) {
        await tx.subjectStatus.createMany({
          data: enrolling.map((s) => ({
            enrollmentId: enr.id, subjectId: s.id, state: "ENROLLED" as const,
          })),
        });
      }
      await tx.studyTask.createMany({
        data: [
          { enrollmentId: enr.id, title: "Prova 1", kind: "PROVA", dueAt: new Date(Date.now() + rand(3, 20) * 864e5) },
          { enrollmentId: enr.id, title: "Entrega do relatório", kind: "ENTREGA", dueAt: new Date(Date.now() + rand(5, 30) * 864e5) },
        ],
      });
    });
    emails.push(email);
  }
  return emails;
}

/** Remove tudo que o gerador criou (e-mails @dev.local); a cascata limpa o resto. */
export async function purgeFakeStudents(prisma: PrismaClient): Promise<number> {
  const res = await prisma.user.deleteMany({ where: { email: { endsWith: "@dev.local" } } });
  return res.count;
}

export const SAMPLE_ANNOUNCEMENTS = [
  { title: "Matrícula 2026.2 aberta", body: "O período de ajuste vai até sexta-feira. Confira sua grade antes de confirmar.", audience: "STUDENTS" as const, pinned: true },
  { title: "Manutenção programada", body: "O painel ficará indisponível no domingo, das 2h às 4h.", audience: "ALL" as const, pinned: false },
  { title: "Nova matriz importada", body: "A matriz de Engenharia Elétrica 2023 foi atualizada no catálogo.", audience: "ADMINS" as const, pinned: false },
];
