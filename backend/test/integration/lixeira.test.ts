// RF-28 (lixeira de cursos) e RF-29 (cronograma inteligente): dois recursos em que um erro
// custa caro — o primeiro apaga dados de todos os alunos de um curso, o segundo aceita ids
// vindos do cliente. Os testes cobrem justamente as guardas.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, createUser, uniqueSlug, authHeader } from "./helpers.js";
import { importCourse } from "../../src/domain/importCourse.js";
import { RETENTION_DAYS, purgeExpiredCourses } from "../../src/modules/courses/service.js";
import { suggestSigla } from "../../src/modules/schedules/service.js";

let app: FastifyInstance;

const matriz = (slug: string) => ({
  course: { slug, name: "Curso Descartável" },
  totalHours: 300,
  requirements: [{ key: "NC", label: "NC", hours: 300 }],
  milestones: [{ key: "CH1", hours: 100, description: "marco" }],
  subjects: [
    { seq: 1, code: "L1", name: "Cálculo Diferencial e Integral II", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
    { seq: 2, code: "L2", name: "Álgebra Linear", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
    { seq: 3, code: "L3", name: "Física Geral", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
  ],
});

const tokenFor = (u: { id: string; role: "ADMIN" | "USER" }) => app.jwt.sign({ sub: u.id, role: u.role });

async function adminHeader() {
  const user = await createUser(app, { role: "ADMIN", password: "senha-admin-123" });
  return authHeader(tokenFor(user));
}

/** cria um curso novo (isolado) e devolve slug + id */
async function freshCourse() {
  const slug = uniqueSlug("lixo");
  await importCourse(app.prisma, matriz(slug));
  const course = await app.prisma.course.findUniqueOrThrow({ where: { slug } });
  return { slug, id: course.id };
}

beforeAll(async () => { app = await makeApp(); });
afterAll(async () => { await app.close(); });

describe("RF-28 — lixeira de cursos", () => {
  it("recusa a exclusão sem a confirmação do slug", async () => {
    const h = await adminHeader();
    const { slug } = await freshCourse();
    const res = await app.inject({
      method: "DELETE", url: `/courses/${slug}`, headers: h, payload: { confirm: "qualquer-coisa" },
    });
    expect(res.statusCode).toBe(400);
    const still = await app.prisma.course.findUniqueOrThrow({ where: { slug } });
    expect(still.deletedAt).toBeNull();
  });

  it("aluno não consegue mandar curso para a lixeira", async () => {
    const user = await createUser(app, { password: "senha-forte-123" });
    const { slug } = await freshCourse();
    const res = await app.inject({
      method: "DELETE", url: `/courses/${slug}`,
      headers: authHeader(tokenFor(user)), payload: { confirm: slug },
    });
    expect(res.statusCode).toBe(403);
  });

  it("com a confirmação correta vai para a lixeira e some do catálogo", async () => {
    const h = await adminHeader();
    const { slug, id } = await freshCourse();

    const res = await app.inject({
      method: "DELETE", url: `/courses/${slug}`, headers: h, payload: { confirm: slug },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().retentionDays).toBe(RETENTION_DAYS);

    // sumiu do catálogo…
    const list = await app.inject({ method: "GET", url: "/courses", headers: h });
    expect((list.json() as { slug: string }[]).some((c) => c.slug === slug)).toBe(false);

    // …mas os dados continuam lá
    expect(await app.prisma.subject.count({ where: { courseId: id } })).toBe(3);

    // e aparece na lixeira com o prazo
    const trash = await app.inject({ method: "GET", url: "/courses/trash", headers: h });
    const item = (trash.json().items as { slug: string; daysLeft: number }[]).find((c) => c.slug === slug);
    expect(item?.daysLeft).toBe(RETENTION_DAYS);
  });

  it("curso na lixeira não aceita matrículas novas", async () => {
    const h = await adminHeader();
    const user = await createUser(app, { password: "senha-forte-123" });
    const { slug } = await freshCourse();
    await app.inject({ method: "DELETE", url: `/courses/${slug}`, headers: h, payload: { confirm: slug } });

    const res = await app.inject({
      method: "POST", url: "/me/enrollments",
      headers: authHeader(tokenFor(user)), payload: { courseSlug: slug },
    });
    expect(res.statusCode).toBe(400);
  });

  it("restaura da lixeira e volta ao catálogo", async () => {
    const h = await adminHeader();
    const { slug, id } = await freshCourse();
    await app.inject({ method: "DELETE", url: `/courses/${slug}`, headers: h, payload: { confirm: slug } });

    const res = await app.inject({ method: "POST", url: `/courses/trash/${id}/restore`, headers: h });
    expect(res.statusCode).toBe(200);
    const list = await app.inject({ method: "GET", url: "/courses", headers: h });
    expect((list.json() as { slug: string }[]).some((c) => c.slug === slug)).toBe(true);
  });

  it("não expurga curso que não passou pela lixeira", async () => {
    const h = await adminHeader();
    const { slug, id } = await freshCourse();
    const res = await app.inject({
      method: "DELETE", url: `/courses/trash/${id}`, headers: h, payload: { confirm: slug },
    });
    expect(res.statusCode).toBe(400);
    expect(await app.prisma.course.findUnique({ where: { id } })).not.toBeNull();
  });

  it("expurga definitivamente com a segunda confirmação", async () => {
    const h = await adminHeader();
    const { slug, id } = await freshCourse();
    await app.inject({ method: "DELETE", url: `/courses/${slug}`, headers: h, payload: { confirm: slug } });

    const res = await app.inject({
      method: "DELETE", url: `/courses/trash/${id}`, headers: h, payload: { confirm: slug },
    });
    expect(res.statusCode).toBe(200);
    expect(await app.prisma.course.findUnique({ where: { id } })).toBeNull();
    expect(await app.prisma.subject.count({ where: { courseId: id } })).toBe(0); // cascade
  });

  it("o expurgo automático só leva o que passou do prazo", async () => {
    const h = await adminHeader();
    const recente = await freshCourse();
    const antigo = await freshCourse();
    await app.inject({ method: "DELETE", url: `/courses/${recente.slug}`, headers: h, payload: { confirm: recente.slug } });
    await app.inject({ method: "DELETE", url: `/courses/${antigo.slug}`, headers: h, payload: { confirm: antigo.slug } });

    // envelhece o segundo para além da janela de retenção
    await app.prisma.course.update({
      where: { id: antigo.id },
      data: { deletedAt: new Date(Date.now() - (RETENTION_DAYS + 1) * 864e5) },
    });

    const purged = await purgeExpiredCourses(app.prisma);
    expect(purged).toContain(antigo.slug);
    expect(purged).not.toContain(recente.slug);
    expect(await app.prisma.course.findUnique({ where: { id: recente.id } })).not.toBeNull();
  });
});

describe("RF-29 — cronograma inteligente", () => {
  /** aluno matriculado, com 1 cursando + 1 simulada + 1 pendente, e um cenário vazio */
  async function aluno() {
    const user = await createUser(app, { password: "senha-forte-123" });
    const { id: courseId } = await freshCourse();
    const enr = await app.prisma.enrollment.create({ data: { userId: user.id, courseId } });
    const subs = await app.prisma.subject.findMany({ where: { courseId }, orderBy: { seq: "asc" } });
    await app.prisma.subjectStatus.createMany({
      data: [
        { enrollmentId: enr.id, subjectId: subs[0]!.id, state: "ENROLLED" },
        { enrollmentId: enr.id, subjectId: subs[1]!.id, state: "SIMULATED" },
        { enrollmentId: enr.id, subjectId: subs[2]!.id, state: "APPROVED" },
      ],
    });
    const scenario = await app.prisma.scenario.create({ data: { enrollmentId: enr.id, name: "Plano A" } });
    return { user, enr, subs, scenario, h: authHeader(tokenFor(user)) };
  }

  it("sugere sigla a partir do nome da disciplina", () => {
    expect(suggestSigla("Cálculo Diferencial e Integral II", "L1")).toBe("CDI-II");
    expect(suggestSigla("Álgebra Linear", "L2")).toBe("ÁL");
  });

  it("lista só cursando e simuladas, com sigla, CH e cor sugeridas", async () => {
    const { scenario, h } = await aluno();
    const res = await app.inject({ method: "GET", url: `/me/scenarios/${scenario.id}/candidates`, headers: h });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as { code: string; state: string; sigla: string; hours: number; color: string }[];
    expect(items.map((i) => i.code).sort()).toEqual(["L1", "L2"]); // a APPROVED fica de fora
    expect(items[0]!.state).toBe("ENROLLED");                       // cursando vem primeiro
    expect(items[0]!.sigla).toBe("CDI-II");
    expect(items[0]!.hours).toBe(100);
    expect(items[0]!.color).toMatch(/^#/);
    expect(items[0]!.color).not.toBe(items[1]!.color);              // cores distintas
  });

  it("adiciona em lote informando apenas o código de horário", async () => {
    const { scenario, subs, h } = await aluno();
    const res = await app.inject({
      method: "POST", url: `/me/scenarios/${scenario.id}/disciplines/bulk`, headers: h,
      payload: { items: [{ subjectId: subs[0]!.id, sigaaCode: "24M12" }, { subjectId: subs[1]!.id }] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().added).toBe(2);

    const created = await app.prisma.scenarioDiscipline.findMany({ where: { scenarioId: scenario.id } });
    const cdi = created.find((d) => d.sigla === "CDI-II")!;
    expect(cdi.name).toBe("Cálculo Diferencial e Integral II"); // nome veio da matriz
    expect(cdi.hours).toBe(100);                                 // CH veio da matriz
    expect(cdi.sigaaCode).toBe("24M12");
  });

  it("rejeita código SIGAA inválido sem gravar nada", async () => {
    const { scenario, subs, h } = await aluno();
    const res = await app.inject({
      method: "POST", url: `/me/scenarios/${scenario.id}/disciplines/bulk`, headers: h,
      payload: { items: [{ subjectId: subs[0]!.id, sigaaCode: "99Z99" }] },
    });
    expect(res.statusCode).toBe(400);
    expect(await app.prisma.scenarioDiscipline.count({ where: { scenarioId: scenario.id } })).toBe(0);
  });

  it("recusa subjectId que não é do aluno (id vindo do cliente não é atalho)", async () => {
    const a = await aluno();
    const b = await aluno(); // outro aluno, outro curso
    const res = await app.inject({
      method: "POST", url: `/me/scenarios/${a.scenario.id}/disciplines/bulk`, headers: a.h,
      payload: { items: [{ subjectId: b.subs[0]!.id, sigaaCode: "24M12" }] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("não duplica disciplina já presente no cenário", async () => {
    const { scenario, subs, h } = await aluno();
    const payload = { items: [{ subjectId: subs[0]!.id, sigaaCode: "24M12" }] };
    await app.inject({ method: "POST", url: `/me/scenarios/${scenario.id}/disciplines/bulk`, headers: h, payload });
    const again = await app.inject({ method: "POST", url: `/me/scenarios/${scenario.id}/disciplines/bulk`, headers: h, payload });
    expect(again.json().added).toBe(0);
    expect(again.json().skipped).toContain("L1");
    expect(await app.prisma.scenarioDiscipline.count({ where: { scenarioId: scenario.id } })).toBe(1);
  });

  it("candidatos marcam o que já está no cenário", async () => {
    const { scenario, subs, h } = await aluno();
    await app.inject({
      method: "POST", url: `/me/scenarios/${scenario.id}/disciplines/bulk`, headers: h,
      payload: { items: [{ subjectId: subs[0]!.id, sigaaCode: "24M12" }] },
    });
    const res = await app.inject({ method: "GET", url: `/me/scenarios/${scenario.id}/candidates`, headers: h });
    const items = res.json().items as { code: string; alreadyInScenario: boolean }[];
    expect(items.find((i) => i.code === "L1")!.alreadyInScenario).toBe(true);
    expect(items.find((i) => i.code === "L2")!.alreadyInScenario).toBe(false);
  });

  it("cenário de outro usuário é inacessível", async () => {
    const a = await aluno();
    const b = await aluno();
    const res = await app.inject({ method: "GET", url: `/me/scenarios/${b.scenario.id}/candidates`, headers: a.h });
    expect(res.statusCode).toBe(403);
  });
});
