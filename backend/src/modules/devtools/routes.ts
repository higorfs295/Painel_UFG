// Ferramentas de desenvolvimento — geram massa de dados realista para exercitar o painel
// (demos, testes manuais, screenshots). SEGURANÇA: exigem ADMIN **e** DEV_TOOLS=true **e**
// NODE_ENV != production (devToolsEnabled já combina flag + ambiente). Em produção respondem 403.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { devToolsEnabled } from "../../env.js";
import { audit } from "../../lib/audit.js";

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabi", "Heitor", "Isis", "João",
  "Karina", "Lucas", "Marina", "Nathan", "Olívia", "Pedro", "Rafa", "Sofia", "Tiago", "Vitória"];
const LAST = ["Almeida", "Barbosa", "Carvalho", "Dias", "Esteves", "Ferreira", "Gomes", "Henriques",
  "Ibrahim", "Ju­nqueira", "Lima", "Moreira", "Nunes", "Oliveira", "Pereira", "Queiroz", "Rocha", "Souza"];
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!;
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export async function devToolsRoutes(app: FastifyInstance) {
  // Guarda dupla: papel + ambiente. Aplica-se a TODAS as rotas deste módulo.
  app.addHook("onRequest", async (_req, reply) => {
    if (!devToolsEnabled)
      return reply.code(403).send({ error: "ferramentas de desenvolvimento desativadas (DEV_TOOLS)" });
  });

  // Gera N alunos fictícios matriculados num curso, com progresso/notas/agenda plausíveis.
  app.post("/students", { preHandler: app.requireAdmin }, async (req, reply) => {
    const body = z.object({
      count: z.number().int().min(1).max(50).default(10),
      courseSlug: z.string(),
      password: z.string().min(10).default("senha-de-teste-123"),
      progress: z.number().min(0).max(1).default(0.4), // fração da matriz já aprovada
    }).parse(req.body);

    const course = await app.prisma.course.findUnique({ where: { slug: body.courseSlug } });
    if (!course) return reply.code(400).send({ error: "curso inexistente" });

    const subjects = await app.prisma.subject.findMany({
      where: { courseId: course.id }, orderBy: { seq: "asc" }, select: { id: true, hours: true },
    });
    if (subjects.length === 0) return reply.code(400).send({ error: "curso sem disciplinas" });

    const hash = await argon2.hash(body.password);
    const created: string[] = [];

    for (let i = 0; i < body.count; i++) {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const email = `dev.${Date.now().toString(36)}${i}@dev.local`;
      const user = await app.prisma.user.create({
        data: {
          name, email, role: "USER", passwordHash: hash,
          matricula: `${rand(2019, 2025)}${rand(100000, 999999)}`,
          shift: pick(["matutino", "vespertino", "noturno", "integral"]),
        },
      });
      const startYear = rand(2019, 2024);
      const enr = await app.prisma.enrollment.create({
        data: { userId: user.id, courseId: course.id, startTerm: `${startYear}.${rand(1, 2)}` },
      });

      // aprova um prefixo da matriz (respeita a ordem da grade => pré-requisitos plausíveis)
      const approvedCount = Math.floor(subjects.length * body.progress * (0.7 + Math.random() * 0.6));
      const rows = subjects.slice(0, Math.min(approvedCount, subjects.length)).map((s, idx) => ({
        enrollmentId: enr.id, subjectId: s.id, state: "APPROVED" as const,
        term: `${startYear + Math.floor(idx / 6)}.${(idx % 2) + 1}`,
        grade: Math.round((5 + Math.random() * 5) * 10) / 10,
        absences: rand(0, 12),
      }));
      if (rows.length) await app.prisma.subjectStatus.createMany({ data: rows });

      // 1–2 cursando logo após o prefixo aprovado
      const enrolling = subjects.slice(rows.length, rows.length + rand(1, 2));
      if (enrolling.length)
        await app.prisma.subjectStatus.createMany({
          data: enrolling.map((s) => ({ enrollmentId: enr.id, subjectId: s.id, state: "ENROLLED" as const })),
        });

      // agenda com uma prova e uma entrega nas próximas semanas
      await app.prisma.studyTask.createMany({
        data: [
          { enrollmentId: enr.id, title: "Prova 1", kind: "PROVA", dueAt: new Date(Date.now() + rand(3, 20) * 864e5) },
          { enrollmentId: enr.id, title: "Entrega do relatório", kind: "ENTREGA", dueAt: new Date(Date.now() + rand(5, 30) * 864e5) },
        ],
      });
      created.push(email);
    }

    await audit(app.prisma, {
      userId: req.user.sub, action: "dev.seed_students",
      meta: { count: created.length, courseSlug: body.courseSlug }, ip: req.ip,
    });
    return reply.code(201).send({ created: created.length, emails: created, password: body.password });
  });

  // Remove tudo que este gerador criou (e-mails @dev.local). Cascata limpa matrículas/progresso.
  app.delete("/students", { preHandler: app.requireAdmin }, async (req) => {
    const res = await app.prisma.user.deleteMany({ where: { email: { endsWith: "@dev.local" } } });
    await audit(app.prisma, {
      userId: req.user.sub, action: "dev.purge_students", meta: { removed: res.count }, ip: req.ip,
    });
    return { removed: res.count };
  });

  // Avisos de exemplo — deixa o feed vivo para demos.
  app.post("/announcements", { preHandler: app.requireAdmin }, async (req, reply) => {
    const samples = [
      { title: "Matrícula 2026.2 aberta", body: "O período de ajuste vai até sexta-feira. Confira sua grade antes de confirmar.", audience: "STUDENTS" as const, pinned: true },
      { title: "Manutenção programada", body: "O painel ficará indisponível no domingo, das 2h às 4h.", audience: "ALL" as const, pinned: false },
      { title: "Nova matriz importada", body: "A matriz de Engenharia Elétrica 2023 foi atualizada no catálogo.", audience: "ADMINS" as const, pinned: false },
    ];
    await app.prisma.announcement.createMany({
      data: samples.map((s) => ({ ...s, authorId: req.user.sub })),
    });
    return reply.code(201).send({ created: samples.length });
  });
}
