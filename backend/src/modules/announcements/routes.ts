// RF-24 — avisos/comunicados da instância. Leitura para qualquer autenticado (filtrada por
// audiência conforme o papel); gestão somente ADMIN. Registrado SEM prefixo (caminhos completos).
//
// v12: um aviso pode mirar um curso (só quem tem matrícula nele vê), ser agendado (`publishAt`)
// e ter validade (`expiresAt`). O feed só mostra o que está "no ar" agora.
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { stripUndefined } from "../../lib/strip.js";
import { badRequest } from "../../lib/errors.js";

type Audience = "ALL" | "STUDENTS" | "ADMINS";

const baseSchema = z.object({
  title: z.string().min(2).max(160),
  body: z.string().min(1).max(4000),
  audience: z.enum(["ALL", "STUDENTS", "ADMINS"]),
  pinned: z.boolean(),
  courseSlug: z.string().min(1).nullable(),   // null = todos os cursos
  publishAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
});
const createSchema = baseSchema.partial({ courseSlug: true, publishAt: true, expiresAt: true })
  .extend({ audience: baseSchema.shape.audience.default("ALL"), pinned: baseSchema.shape.pinned.default(false) });
const patchSchema = baseSchema.partial();

const include = {
  author: { select: { name: true } },
  course: { select: { slug: true, name: true } },
} as const;

/** Situação derivada no servidor (relógio único): agendado, no ar ou expirado. */
function withStatus<T extends { publishAt: Date; expiresAt: Date | null }>(a: T, now = new Date()) {
  const status = a.publishAt > now ? "scheduled" : a.expiresAt && a.expiresAt <= now ? "expired" : "live";
  return { ...a, status };
}

async function resolveCourse(prisma: PrismaClient, slug: string | null | undefined) {
  if (slug === undefined) return undefined;   // PATCH sem a chave: não mexe
  if (slug === null) return null;              // "todos os cursos"
  const course = await prisma.course.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
  if (!course) throw badRequest("curso inexistente");
  return course.id;
}

function checkWindow(publishAt: Date | undefined, expiresAt: Date | null | undefined) {
  if (expiresAt && expiresAt <= (publishAt ?? new Date()))
    throw badRequest("a validade precisa terminar depois da publicação");
}

export async function announcementRoutes(app: FastifyInstance) {
  // Feed do usuário logado: só o que está no ar, da audiência dele e dos cursos em que tem
  // matrícula (ou para todos os cursos). Fixados primeiro, depois mais recentes.
  app.get("/announcements", { preHandler: app.requireAuth }, async (req) => {
    const q = z.object({ limit: z.coerce.number().int().positive().max(50).default(20) }).parse(req.query);
    const enrollments = await app.prisma.enrollment.findMany({
      where: { userId: req.user.sub }, select: { courseId: true },
    });
    const courseIds = enrollments.map((e) => e.courseId);
    // um admin que também cursa (v12: modo aluno) recebe os avisos de alunos
    const forRole: Audience[] = req.user.role === "ADMIN"
      ? (courseIds.length ? ["ALL", "ADMINS", "STUDENTS"] : ["ALL", "ADMINS"])
      : ["ALL", "STUDENTS"];
    const now = new Date();
    const rows = await app.prisma.announcement.findMany({
      where: {
        audience: { in: forRole },
        publishAt: { lte: now },
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          { OR: [{ courseId: null }, { courseId: { in: courseIds } }] },
        ],
      },
      orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
      take: q.limit,
      include,
    });
    return rows.map((a) => withStatus(a, now));
  });

  // Gestão (ADMIN) — lista TODOS (agendados, expirados, de qualquer curso/audiência).
  app.get("/admin/announcements", { preHandler: app.requireAdmin }, async () => {
    const rows = await app.prisma.announcement.findMany({
      orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
      include,
    });
    const now = new Date();
    return rows.map((a) => withStatus(a, now));
  });

  app.post("/admin/announcements", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { courseSlug, ...body } = createSchema.parse(req.body);
    checkWindow(body.publishAt, body.expiresAt);
    const courseId = await resolveCourse(app.prisma, courseSlug);
    const created = await app.prisma.announcement.create({
      data: {
        title: body.title, body: body.body, audience: body.audience, pinned: body.pinned,
        ...(body.publishAt ? { publishAt: body.publishAt } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
        ...(courseId ? { courseId } : {}),
        authorId: req.user.sub,
      },
      include,
    });
    await audit(app.prisma, {
      userId: req.user.sub, action: "announcement.create", entity: "Announcement",
      entityId: created.id,
      meta: { title: body.title, audience: body.audience, course: courseSlug ?? null }, ip: req.ip,
    });
    return reply.code(201).send(withStatus(created));
  });

  app.patch("/admin/announcements/:id", { preHandler: app.requireAdmin }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { courseSlug, ...patch } = patchSchema.parse(req.body);
    const current = await app.prisma.announcement.findUnique({ where: { id } });
    if (!current) throw badRequest("aviso inexistente");
    checkWindow(patch.publishAt ?? current.publishAt,
      patch.expiresAt === undefined ? current.expiresAt : patch.expiresAt);
    const courseId = await resolveCourse(app.prisma, courseSlug);
    const updated = await app.prisma.announcement.update({
      where: { id },
      data: { ...stripUndefined(patch), ...(courseId !== undefined ? { courseId } : {}) },
      include,
    });
    await audit(app.prisma, {
      userId: req.user.sub, action: "announcement.update", entity: "Announcement", entityId: id, ip: req.ip,
    });
    return withStatus(updated);
  });

  app.delete("/admin/announcements/:id", { preHandler: app.requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await app.prisma.announcement.delete({ where: { id } });
    await audit(app.prisma, {
      userId: req.user.sub, action: "announcement.delete", entity: "Announcement", entityId: id, ip: req.ip,
    });
    return reply.code(204).send();
  });
}
