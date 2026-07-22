// RF-10/11/12 — cenários de cronograma, disciplinas com código SIGAA e pintura de atividades.
// O parser SIGAA roda também no servidor (RF-11): nunca confiar só no cliente.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertEnrollmentOwner, assertScenarioOwner } from "../../lib/ownership.js";
import { stripUndefined } from "../../lib/strip.js";
import { parseSIGAA } from "../../domain/sigaa.js";
import { bulkAddFromStatuses, scenarioCandidates } from "./service.js";

// RF-29: o aluno só informa o código de horário; nome/CH/sigla/cor vêm da matriz
const bulkSchema = z.object({
  items: z.array(z.object({
    subjectId: z.string().min(1),
    sigaaCode: z.string().optional(),
    sigla: z.string().optional(),
    color: z.string().optional(),
    docente: z.string().optional(),
  })).min(1).max(20),
});

const disciplineSchema = z.object({
  name: z.string().min(1), sigla: z.string().min(1),
  hours: z.number().int().min(0).default(0),
  docente: z.string().optional(),
  sigaaCode: z.string().default(""),
  color: z.string().min(1),
});

// valida o código SIGAA e devolve os slots; erro 400 com os tokens inválidos.
function validateSigaa(code: string): string[] {
  if (!code.trim()) return [];
  const { slots, errs } = parseSIGAA(code);
  if (errs.length) throw new SigaaError(errs);
  return slots;
}
class SigaaError extends Error {
  constructor(public errs: string[]) { super("código SIGAA inválido"); }
}

export async function scheduleRoutes(app: FastifyInstance) {
  app.get("/enrollments/:id/scenarios", { preHandler: app.requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await assertEnrollmentOwner(app.prisma, id, req.user.sub);
    return app.prisma.scenario.findMany({
      where: { enrollmentId: id },
      include: { disciplines: true, paints: true },
    });
  });

  // criar cenário (opcionalmente duplicando disciplinas/pinturas de outro)
  app.post("/enrollments/:id/scenarios", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { name, copyFrom } = z.object({
      name: z.string().min(1), copyFrom: z.string().optional(),
    }).parse(req.body);
    await assertEnrollmentOwner(app.prisma, id, req.user.sub);

    let disciplines, paints;
    if (copyFrom) {
      const src = await assertScenarioOwner(app.prisma, copyFrom, req.user.sub);
      if (src.enrollmentId !== id) return reply.code(400).send({ error: "cenário de origem de outro enrollment" });
      const full = await app.prisma.scenario.findUnique({
        where: { id: copyFrom }, include: { disciplines: true, paints: true },
      });
      disciplines = full!.disciplines.map(({ id: _i, scenarioId: _s, ...d }) => d);
      paints = full!.paints.map(({ id: _i, scenarioId: _s, ...p }) => p);
    }
    const created = await app.prisma.scenario.create({
      data: {
        enrollmentId: id, name,
        ...(disciplines ? { disciplines: { create: disciplines } } : {}),
        ...(paints ? { paints: { create: paints } } : {}),
      },
      include: { disciplines: true, paints: true },
    });
    return reply.code(201).send(created);
  });

  app.patch("/scenarios/:sid", { preHandler: app.requireAuth }, async (req) => {
    const { sid } = z.object({ sid: z.string() }).parse(req.params);
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    await assertScenarioOwner(app.prisma, sid, req.user.sub);
    return app.prisma.scenario.update({ where: { id: sid }, data: { name } });
  });

  app.delete("/scenarios/:sid", { preHandler: app.requireAuth }, async (req, reply) => {
    const { sid } = z.object({ sid: z.string() }).parse(req.params);
    await assertScenarioOwner(app.prisma, sid, req.user.sub);
    await app.prisma.scenario.delete({ where: { id: sid } });
    return reply.code(204).send();
  });

  app.post("/scenarios/:sid/disciplines", { preHandler: app.requireAuth }, async (req, reply) => {
    const { sid } = z.object({ sid: z.string() }).parse(req.params);
    const body = disciplineSchema.parse(req.body);
    await assertScenarioOwner(app.prisma, sid, req.user.sub);
    const slots = validateSigaa(body.sigaaCode);
    const created = await app.prisma.scenarioDiscipline.create({
      data: { scenarioId: sid, ...body, docente: body.docente ?? null },
    });
    return reply.code(201).send({ ...created, slots });
  });

  // RF-29 — o que dá para puxar automaticamente: cursando/simuladas ainda fora do cenário,
  // já com sigla, carga horária e cor sugeridas.
  app.get("/scenarios/:sid/candidates", { preHandler: app.requireAuth }, async (req) => {
    const { sid } = z.object({ sid: z.string() }).parse(req.params);
    const scenario = await assertScenarioOwner(app.prisma, sid, req.user.sub);
    return { items: await scenarioCandidates(app.prisma, sid, scenario.enrollmentId) };
  });

  // RF-29 — insere em lote: do cliente vem apenas subjectId + código de horário.
  app.post("/scenarios/:sid/disciplines/bulk", { preHandler: app.requireAuth }, async (req, reply) => {
    const { sid } = z.object({ sid: z.string() }).parse(req.params);
    const { items } = bulkSchema.parse(req.body);
    const scenario = await assertScenarioOwner(app.prisma, sid, req.user.sub);
    const result = await bulkAddFromStatuses(
      app.prisma, sid, scenario.enrollmentId, items, validateSigaa);
    return reply.code(201).send(result);
  });

  app.patch("/scenarios/:sid/disciplines/:did", { preHandler: app.requireAuth }, async (req, reply) => {
    const { sid, did } = z.object({ sid: z.string(), did: z.string() }).parse(req.params);
    const patch = disciplineSchema.partial().parse(req.body);
    await assertScenarioOwner(app.prisma, sid, req.user.sub);
    const existing = await app.prisma.scenarioDiscipline.findUnique({ where: { id: did } });
    if (!existing || existing.scenarioId !== sid)
      return reply.code(404).send({ error: "disciplina não encontrada neste cenário" });
    if (patch.sigaaCode !== undefined) validateSigaa(patch.sigaaCode);
    const updated = await app.prisma.scenarioDiscipline.update({
      where: { id: did },
      data: { ...stripUndefined(patch), ...(patch.docente !== undefined ? { docente: patch.docente ?? null } : {}) },
    });
    return reply.send(updated);
  });

  app.delete("/scenarios/:sid/disciplines/:did", { preHandler: app.requireAuth }, async (req, reply) => {
    const { sid, did } = z.object({ sid: z.string(), did: z.string() }).parse(req.params);
    await assertScenarioOwner(app.prisma, sid, req.user.sub);
    const existing = await app.prisma.scenarioDiscipline.findUnique({ where: { id: did } });
    if (!existing || existing.scenarioId !== sid)
      return reply.code(404).send({ error: "disciplina não encontrada neste cenário" });
    await app.prisma.scenarioDiscipline.delete({ where: { id: did } });
    return reply.code(204).send();
  });

  // RF-12: pinta/limpa uma célula da grade. category vazia => remove a pintura.
  app.put("/scenarios/:sid/paint", { preHandler: app.requireAuth }, async (req, reply) => {
    const { sid } = z.object({ sid: z.string() }).parse(req.params);
    const { cellKey, category } = z.object({
      cellKey: z.string().min(1), category: z.string(),
    }).parse(req.body);
    await assertScenarioOwner(app.prisma, sid, req.user.sub);

    if (!category) {
      await app.prisma.scenarioPaint.deleteMany({ where: { scenarioId: sid, cellKey } });
      return reply.code(204).send();
    }
    const saved = await app.prisma.scenarioPaint.upsert({
      where: { scenarioId_cellKey: { scenarioId: sid, cellKey } },
      update: { category },
      create: { scenarioId: sid, cellKey, category },
    });
    return reply.send(saved);
  });
}

export { SigaaError };
