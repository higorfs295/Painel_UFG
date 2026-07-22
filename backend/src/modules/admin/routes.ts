// RF-21 — visão administrativa: estatísticas da instância e calendário acadêmico global
// (RF-20 v2). Tudo somente ADMIN; o calendário vale para todos os usuários.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { TERM_RE, resolvePeriod } from "../../domain/period.js";
import { env, mailerConfigured, allowRegistration, devToolsEnabled, docsEnabled } from "../../env.js";
import { sendTestEmail } from "../../lib/mailer.js";
import { audit } from "../../lib/audit.js";
import { fieldCryptoEnabled } from "../../lib/fieldCrypto.js";

export async function adminRoutes(app: FastifyInstance) {
  // Configurações da instância (somente leitura — vêm do ambiente) + estado do e-mail.
  app.get("/config", { preHandler: app.requireAdmin }, async () => ({
    registration: { allowed: allowRegistration },
    invite: { expiresHours: env.INVITE_EXPIRES_HOURS },
    appUrl: env.APP_URL,
    env: env.NODE_ENV,
    devTools: devToolsEnabled,
    mail: {
      configured: mailerConfigured,
      host: env.SMTP_HOST ?? null,
      port: env.SMTP_PORT,
      from: env.MAIL_FROM,
      user: env.SMTP_USER ?? null,
    },
    // estado das camadas de proteção/ferramentas (só o BOOLEANO — nunca a chave em si)
    security: { fieldEncryption: fieldCryptoEnabled },
    tools: { devTools: devToolsEnabled, docs: docsEnabled },
  }));

  // Envia um e-mail de teste para o próprio admin — valida o SMTP.
  app.post("/mail/test", { preHandler: app.requireAdmin }, async (req, reply) => {
    const me = await app.prisma.user.findUnique({ where: { id: req.user.sub }, select: { email: true } });
    if (!me) return reply.code(404).send({ error: "usuário não encontrado" });
    try {
      await sendTestEmail(me.email);
      return { sent: true, to: me.email };
    } catch (err) {
      return reply.code(400).send({ sent: false, error: err instanceof Error ? err.message : "falha ao enviar" });
    }
  });

  app.get("/stats", { preHandler: app.requireAdmin }, async () => {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      users, admins, pendingInvites, courses, enrollments, statuses, extras, scenarios,
      newUsers30d, byCourseRaw, courseRows,
    ] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.user.count({ where: { role: "ADMIN" } }),
      app.prisma.user.count({ where: { passwordHash: null } }),
      app.prisma.course.count({ where: { deletedAt: null } }), // cursos na lixeira não contam (RF-28)
      app.prisma.enrollment.count(),
      app.prisma.subjectStatus.count(),
      app.prisma.extraComponent.count(),
      app.prisma.scenario.count(),
      // +1 métrica admin: crescimento — cadastros nos últimos 30 dias
      app.prisma.user.count({ where: { createdAt: { gte: since30d } } }),
      // +2 métrica admin: distribuição de matrículas por curso
      app.prisma.enrollment.groupBy({ by: ["courseId"], _count: { _all: true } }),
      app.prisma.course.findMany({ select: { id: true, slug: true, name: true } }),
    ]);

    const nameById = new Map(courseRows.map((c) => [c.id, c]));
    const byCourse = byCourseRaw
      .map((g) => ({
        slug: nameById.get(g.courseId)?.slug ?? "?",
        name: nameById.get(g.courseId)?.name ?? "(curso removido)",
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      users: { total: users, admins, pendingInvites, newUsers30d },
      courses,
      enrollments,
      byCourse,
      activity: { subjectStatuses: statuses, extras, scenarios },
    };
  });

  // Calendário acadêmico: lista as entradas agendadas + o período resolvido agora.
  app.get("/periods", { preHandler: app.requireAdmin }, async () => {
    const entries = await app.prisma.academicPeriod.findMany({ orderBy: { startsAt: "asc" } });
    return { entries, current: resolvePeriod(entries) };
  });

  // Agenda uma virada: em startsAt começa um TERM ("2026.2") ou um BREAK (férias).
  // Datas passadas são aceitas de propósito — é assim que se define o período vigente.
  app.post("/periods", { preHandler: app.requireAdmin }, async (req, reply) => {
    const body = z.object({
      type: z.enum(["TERM", "BREAK"]),
      term: z.string().regex(TERM_RE, "formato AAAA.S (ex.: 2026.2)").nullish(),
      startsAt: z.coerce.date(),
    }).parse(req.body);
    if (body.type === "TERM" && !body.term)
      return reply.code(400).send({ error: "período letivo exige o rótulo (ex.: 2026.2)" });

    const entry = await app.prisma.academicPeriod.upsert({
      where: { startsAt: body.startsAt }, // 1 virada por data — reagendar sobrescreve
      update: { type: body.type, term: body.type === "TERM" ? body.term! : null },
      create: {
        type: body.type,
        term: body.type === "TERM" ? body.term! : null,
        startsAt: body.startsAt,
      },
    });
    await audit(app.prisma, {
      userId: req.user.sub, action: "period.schedule", entity: "AcademicPeriod", entityId: entry.id,
      meta: { type: entry.type, term: entry.term, startsAt: entry.startsAt.toISOString() }, ip: req.ip,
    });
    return reply.code(201).send(entry);
  });

  app.delete("/periods/:id", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await app.prisma.academicPeriod.delete({ where: { id } }).catch(() => null);
    await audit(app.prisma, {
      userId: req.user.sub, action: "period.delete", entity: "AcademicPeriod", entityId: id, ip: req.ip,
    });
    return reply.code(204).send();
  });
}
