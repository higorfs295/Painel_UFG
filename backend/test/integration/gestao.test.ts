// Gestão acadêmica ampliada (RF-22..27): notas/histórico, conquistas, agenda, anotações,
// avisos por audiência, auditoria, métricas, sessões e o bloqueio das ferramentas de dev.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, createUser, login, uniqueSlug, authHeader } from "./helpers.js";
import { importCourse } from "../../src/domain/importCourse.js";

let app: FastifyInstance;
let courseSlug: string;
let subjectIds: string[] = [];

const matriz = (slug: string) => ({
  course: { slug, name: "Curso Gestão" },
  totalHours: 400,
  requirements: [{ key: "NC", label: "NC", hours: 400 }],
  milestones: [{ key: "CH1", hours: 100, description: "primeiro marco" }],
  subjects: [
    { seq: 1, code: "G1", name: "Um", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
    { seq: 2, code: "G2", name: "Dois", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
    { seq: 3, code: "G3", name: "Três", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
  ],
});

// Emite o access token direto (mesmos claims do /auth/login). Estes testes não exercitam o
// login — e o POST /auth/login tem rate limit estrito (10/min por IP), que estouraria aqui.
const tokenFor = (u: { id: string; role: "ADMIN" | "USER" }) =>
  app.jwt.sign({ sub: u.id, role: u.role });

// cria um aluno já matriculado no curso de teste, com cabeçalho pronto
async function student() {
  const user = await createUser(app, { password: "senha-forte-123" });
  const course = await app.prisma.course.findUniqueOrThrow({ where: { slug: courseSlug } });
  const enr = await app.prisma.enrollment.create({ data: { userId: user.id, courseId: course.id } });
  return { user, enr, h: authHeader(tokenFor(user)) };
}

// cria um admin com cabeçalho pronto
async function adminUser() {
  const user = await createUser(app, { role: "ADMIN", password: "senha-admin-123" });
  return { user, h: authHeader(tokenFor(user)) };
}

beforeAll(async () => {
  app = await makeApp();
  courseSlug = uniqueSlug("gest");
  await importCourse(app.prisma, matriz(courseSlug));
  const course = await app.prisma.course.findUniqueOrThrow({ where: { slug: courseSlug } });
  const subs = await app.prisma.subject.findMany({ where: { courseId: course.id }, orderBy: { seq: "asc" } });
  subjectIds = subs.map((s) => s.id);
});
afterAll(async () => { await app.close(); });

describe("notas, faltas e histórico (RF-22)", () => {
  it("persiste nota/faltas/período e agrega histórico com MGA ponderada", async () => {
    const { enr, h } = await student();

    // 100h nota 10 em 2024.1 e 100h nota 6 em 2024.2 => MGA (10*100+6*100)/200 = 8
    const put = await app.inject({
      method: "PUT", url: `/me/enrollments/${enr.id}/subjects/${subjectIds[0]}`, headers: h,
      payload: { state: "APPROVED", grade: 10, absences: 2, term: "2024.1" },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toMatchObject({ grade: 10, absences: 2, term: "2024.1" });

    await app.inject({
      method: "PUT", url: `/me/enrollments/${enr.id}/subjects/${subjectIds[1]}`, headers: h,
      payload: { state: "APPROVED", grade: 6, term: "2024.2" },
    });

    const hist = (await app.inject({ method: "GET", url: `/me/enrollments/${enr.id}/history`, headers: h })).json();
    expect(hist.mga).toBe(8);
    expect(hist.terms.map((t: { term: string }) => t.term)).toEqual(["2024.1", "2024.2"]);
    expect(hist.terms[0]).toMatchObject({ hours: 100, count: 1, avg: 10 });
    expect(hist.totals).toMatchObject({ integralized: 200, required: 400, remaining: 200 });
    expect(hist.records).toHaveLength(2);
  });

  it("rejeita nota fora de 0..10 e período mal formatado", async () => {
    const { enr, h } = await student();
    const badGrade = await app.inject({
      method: "PUT", url: `/me/enrollments/${enr.id}/subjects/${subjectIds[0]}`, headers: h,
      payload: { state: "APPROVED", grade: 11 },
    });
    expect(badGrade.statusCode).toBe(400);
    const badTerm = await app.inject({
      method: "PUT", url: `/me/enrollments/${enr.id}/subjects/${subjectIds[0]}`, headers: h,
      payload: { state: "APPROVED", term: "24-1" },
    });
    expect(badTerm.statusCode).toBe(400);
  });

  it("conquistas são derivadas do progresso (RF-23)", async () => {
    const { enr, h } = await student();
    await app.inject({
      method: "PUT", url: `/me/enrollments/${enr.id}/subjects/${subjectIds[0]}`, headers: h,
      payload: { state: "APPROVED", grade: 9, term: "2024.1" },
    });
    const res = (await app.inject({ method: "GET", url: `/me/enrollments/${enr.id}/achievements`, headers: h })).json();
    const earned = new Set(res.achievements.filter((a: { earned: boolean }) => a.earned)
      .map((a: { key: string }) => a.key));
    expect(earned).toContain("primeira-luz");   // 1 aprovada
    expect(earned).toContain("marco-zero");     // 100h >= CH1(100)
    expect(res.total).toBeGreaterThan(0);
  });
});

describe("agenda e anotações (RF-25/26)", () => {
  it("CRUD de tarefas escopado ao dono", async () => {
    const { enr, h } = await student();
    const created = await app.inject({
      method: "POST", url: `/me/enrollments/${enr.id}/tasks`, headers: h,
      payload: { title: "Prova de Cálculo", kind: "PROVA", dueAt: "2026-09-01T12:00:00Z" },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    const patched = await app.inject({
      method: "PATCH", url: `/me/tasks/${id}`, headers: h, payload: { done: true },
    });
    expect(patched.json().done).toBe(true);

    // outro usuário não enxerga nem altera
    const other = await student();
    const forbidden = await app.inject({ method: "PATCH", url: `/me/tasks/${id}`, headers: other.h, payload: { done: false } });
    expect(forbidden.statusCode).toBe(403);

    const del = await app.inject({ method: "DELETE", url: `/me/tasks/${id}`, headers: h });
    expect(del.statusCode).toBe(204);
  });

  it("anotação por disciplina faz upsert e texto vazio limpa", async () => {
    const { enr, h } = await student();
    const url = `/me/enrollments/${enr.id}/subjects/${subjectIds[0]}/note`;
    await app.inject({ method: "PUT", url, headers: h, payload: { text: "revisar limites" } });
    const up = await app.inject({ method: "PUT", url, headers: h, payload: { text: "revisar derivadas" } });
    expect(up.json().text).toBe("revisar derivadas");

    const list = (await app.inject({ method: "GET", url: `/me/enrollments/${enr.id}/notes`, headers: h })).json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ code: "G1", text: "revisar derivadas" });

    const cleared = await app.inject({ method: "PUT", url, headers: h, payload: { text: "  " } });
    expect(cleared.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/me/enrollments/${enr.id}/notes`, headers: h })).json()).toHaveLength(0);
  });
});

describe("avisos por audiência (RF-24)", () => {
  it("aluno não vê avisos de ADMINS; admin gere o feed", async () => {
    const { h: ah } = await adminUser();

    const onlyAdmins = await app.inject({
      method: "POST", url: "/admin/announcements", headers: ah,
      payload: { title: "Interno", body: "só para admins", audience: "ADMINS" },
    });
    expect(onlyAdmins.statusCode).toBe(201);
    await app.inject({
      method: "POST", url: "/admin/announcements", headers: ah,
      payload: { title: "Matrícula aberta", body: "para alunos", audience: "STUDENTS", pinned: true },
    });

    const { h } = await student();
    const feed = (await app.inject({ method: "GET", url: "/announcements", headers: h })).json();
    const titles = feed.map((a: { title: string }) => a.title);
    expect(titles).toContain("Matrícula aberta");
    expect(titles).not.toContain("Interno");

    // usuário comum não gere avisos
    const nope = await app.inject({
      method: "POST", url: "/admin/announcements", headers: h,
      payload: { title: "x", body: "y" },
    });
    expect(nope.statusCode).toBe(403);

    await app.inject({ method: "DELETE", url: `/admin/announcements/${onlyAdmins.json().id}`, headers: ah });
  });
});

describe("observabilidade e segurança (RF-27)", () => {
  it("login entra na auditoria e /admin/audit filtra por ação", async () => {
    // aqui o login É o objeto do teste (precisa gerar a entrada de auditoria)
    const admin = await createUser(app, { role: "ADMIN", password: "senha-admin-123" });
    const { accessToken } = await login(app, admin.email, "senha-admin-123");
    const ah = authHeader(accessToken);

    const audit = (await app.inject({
      method: "GET", url: "/admin/audit?action=auth.&limit=50", headers: ah,
    })).json();
    expect(audit.entries.some((e: { action: string; userId: string | null }) =>
      e.action === "auth.login" && e.userId === admin.id)).toBe(true);
  });

  it("métricas expõem contadores, latências e ping do banco", async () => {
    const { h } = await adminUser();
    const m = (await app.inject({ method: "GET", url: "/admin/metrics", headers: h })).json();
    expect(m.http.total).toBeGreaterThan(0);
    expect(m.db.ok).toBe(true);
    expect(m.process.rssMb).toBeGreaterThan(0);
    expect(Array.isArray(m.http.topRoutes)).toBe(true);
  });

  it("usuário comum não acessa métricas nem auditoria", async () => {
    const { h } = await student();
    expect((await app.inject({ method: "GET", url: "/admin/metrics", headers: h })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/admin/audit", headers: h })).statusCode).toBe(403);
  });

  it("sessões ativas listam sem vazar token e revoke-others preserva a atual", async () => {
    const user = await createUser(app, { password: "senha-forte-123" });
    const s1 = await login(app, user.email, "senha-forte-123");
    await login(app, user.email, "senha-forte-123"); // segunda sessão

    const list = (await app.inject({ method: "GET", url: "/me/sessions", headers: authHeader(s1.accessToken) })).json();
    expect(list.count).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(list)).not.toMatch(/tokenHash|token"/);

    const revoked = await app.inject({
      method: "POST", url: "/me/sessions/revoke-others",
      headers: { ...authHeader(s1.accessToken), cookie: s1.refreshCookie },
    });
    expect(revoked.json().revoked).toBeGreaterThanOrEqual(1);

    // a sessão atual continua válida (consegue rotacionar o refresh)
    const stillValid = await app.inject({ method: "POST", url: "/auth/refresh", headers: { cookie: s1.refreshCookie } });
    expect(stillValid.statusCode).toBe(200);
  });

  it("ferramentas de dev ficam bloqueadas sem DEV_TOOLS", async () => {
    const { h } = await adminUser();
    const res = await app.inject({
      method: "POST", url: "/admin/dev/students", headers: h,
      payload: { count: 1, courseSlug },
    });
    expect(res.statusCode).toBe(403); // DEV_TOOLS=false por padrão nos testes
  });
});
