// Novas features (preparação open source): cadastro público (RF-17), estado CURSANDO (RF-19),
// período (RF-20), troca de senha, admin ampliado (RF-21) e auto-matrícula.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, createUser, login, uniqueEmail, uniqueSlug, authHeader } from "./helpers.js";
import { importCourse } from "../../src/domain/importCourse.js";

let app: FastifyInstance;
let courseSlug: string;
let subjectId: string;

const matriz = (slug: string) => ({
  course: { slug, name: "Curso Features" },
  totalHours: 200,
  requirements: [{ key: "NC", label: "NC", hours: 200 }],
  milestones: [],
  subjects: [
    { seq: 1, code: "F1", name: "Um", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
    { seq: 2, code: "F2", name: "Dois", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
  ],
});

beforeAll(async () => {
  app = await makeApp();
  courseSlug = uniqueSlug("feat");
  await importCourse(app.prisma, matriz(courseSlug));
  const course = await app.prisma.course.findUniqueOrThrow({ where: { slug: courseSlug } });
  const s = await app.prisma.subject.findFirstOrThrow({ where: { courseId: course.id, seq: 1 } });
  subjectId = s.id;
});
afterAll(async () => { await app.close(); });

describe("cadastro público (RF-17)", () => {
  it("registra, autentica na resposta e permite auto-matrícula", async () => {
    const email = uniqueEmail("reg");
    const res = await app.inject({
      method: "POST", url: "/auth/register",
      payload: { name: "Novata Silva", email, password: "senha-bem-forte" },
    });
    expect(res.statusCode).toBe(201);
    const { accessToken, user } = res.json();
    expect(user.role).toBe("USER");
    expect(res.cookies.find(c => c.name === "rt")).toBeTruthy();

    // auto-matrícula no curso do catálogo
    const enr = await app.inject({
      method: "POST", url: "/me/enrollments", headers: authHeader(accessToken),
      payload: { courseSlug },
    });
    expect(enr.statusCode).toBe(201);
    expect(enr.json().course.slug).toBe(courseSlug);
  });

  it("e-mail duplicado -> 409", async () => {
    const email = uniqueEmail("dup");
    await app.inject({ method: "POST", url: "/auth/register", payload: { name: "Ana", email, password: "senha-bem-forte" } });
    const again = await app.inject({ method: "POST", url: "/auth/register", payload: { name: "Ana", email, password: "senha-bem-forte" } });
    expect(again.statusCode).toBe(409);
  });
});

describe("estado CURSANDO (RF-19)", () => {
  it("ENROLLED não soma no oficial, soma na projeção e sai das recomendações", async () => {
    const user = await createUser(app, { password: "senha-forte-123" });
    const course = await app.prisma.course.findUniqueOrThrow({ where: { slug: courseSlug } });
    const enr = await app.prisma.enrollment.create({ data: { userId: user.id, courseId: course.id } });
    const { accessToken } = await login(app, user.email, "senha-forte-123");

    const put = await app.inject({
      method: "PUT", url: `/me/enrollments/${enr.id}/subjects/${subjectId}`,
      headers: authHeader(accessToken), payload: { state: "ENROLLED" },
    });
    expect(put.statusCode).toBe(200);

    const prog = (await app.inject({
      method: "GET", url: `/me/enrollments/${enr.id}/progress`, headers: authHeader(accessToken),
    })).json();
    expect(prog.totals.hours).toBe(0);                    // oficial: cursando não conta
    expect(prog.projected.totals.hours).toBe(100);        // projeção: conta
    expect(prog.subjects.find((s: any) => s.seq === 1).state).toBe("ENROLLED");

    const recs = (await app.inject({
      method: "GET", url: `/me/enrollments/${enr.id}/recommendations`, headers: authHeader(accessToken),
    })).json();
    expect(recs.map((r: any) => r.seq)).not.toContain(1); // cursando não é recomendada
  });
});

describe("período letivo (RF-20)", () => {
  it("GET /me expõe a sugestão; PATCH /me/enrollments/:id persiste currentTerm", async () => {
    const user = await createUser(app, { password: "senha-forte-123" });
    const course = await app.prisma.course.findUniqueOrThrow({ where: { slug: courseSlug } });
    const enr = await app.prisma.enrollment.create({ data: { userId: user.id, courseId: course.id } });
    const { accessToken } = await login(app, user.email, "senha-forte-123");

    const me = (await app.inject({ method: "GET", url: "/me", headers: authHeader(accessToken) })).json();
    expect(me.period).toHaveProperty("label");
    expect(me.period).toHaveProperty("onBreak");

    const patch = await app.inject({
      method: "PATCH", url: `/me/enrollments/${enr.id}`,
      headers: authHeader(accessToken), payload: { currentTerm: "2026.2" },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().currentTerm).toBe("2026.2");

    const bad = await app.inject({
      method: "PATCH", url: `/me/enrollments/${enr.id}`,
      headers: authHeader(accessToken), payload: { currentTerm: "verao-2026" },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe("troca de senha", () => {
  it("exige a senha atual e revoga as outras sessões", async () => {
    const user = await createUser(app, { password: "senha-antiga-123" });
    const { accessToken, refreshCookie } = await login(app, user.email, "senha-antiga-123");

    const wrong = await app.inject({
      method: "POST", url: "/me/password", headers: authHeader(accessToken),
      payload: { current: "errada", next: "senha-nova-12345" },
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await app.inject({
      method: "POST", url: "/me/password", headers: authHeader(accessToken),
      payload: { current: "senha-antiga-123", next: "senha-nova-12345" },
    });
    expect(ok.statusCode).toBe(204);

    // o refresh antigo foi revogado
    const refresh = await app.inject({ method: "POST", url: "/auth/refresh", headers: { cookie: refreshCookie } });
    expect(refresh.statusCode).toBe(401);

    // e a senha nova loga
    const relogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password: "senha-nova-12345" } });
    expect(relogin.statusCode).toBe(200);
  });
});

describe("admin ampliado (RF-21)", () => {
  it("promove papel, matricula/desmatricula usuário e expõe estatísticas", async () => {
    const admin = await createUser(app, { role: "ADMIN", password: "senha-admin-123" });
    const alvo = await createUser(app, { password: "senha-alvo-1234" });
    const { accessToken } = await login(app, admin.email, "senha-admin-123");

    // promover
    const promo = await app.inject({
      method: "PATCH", url: `/users/${alvo.id}`, headers: authHeader(accessToken),
      payload: { role: "ADMIN" },
    });
    expect(promo.statusCode).toBe(200);
    expect(promo.json().role).toBe("ADMIN");

    // não pode rebaixar a si mesmo
    const self = await app.inject({
      method: "PATCH", url: `/users/${admin.id}`, headers: authHeader(accessToken),
      payload: { role: "USER" },
    });
    expect(self.statusCode).toBe(400);

    // matricular / desmatricular
    const enr = await app.inject({
      method: "POST", url: `/users/${alvo.id}/enrollments`, headers: authHeader(accessToken),
      payload: { courseSlug },
    });
    expect(enr.statusCode).toBe(201);
    const del = await app.inject({
      method: "DELETE", url: `/users/${alvo.id}/enrollments/${enr.json().enrollmentId}`,
      headers: authHeader(accessToken),
    });
    expect(del.statusCode).toBe(204);

    // estatísticas
    const stats = (await app.inject({ method: "GET", url: "/admin/stats", headers: authHeader(accessToken) })).json();
    expect(stats.users.total).toBeGreaterThan(0);
    expect(stats).toHaveProperty("courses");

    // USER comum não acessa. (Nota: o papel vive no claim do JWT — um rebaixamento só vale
    // para tokens emitidos DEPOIS dele; por isso o login do alvo vem após o PATCH.)
    await app.inject({ method: "PATCH", url: `/users/${alvo.id}`, headers: authHeader(accessToken), payload: { role: "USER" } });
    const { accessToken: alvoToken } = await login(app, alvo.email, "senha-alvo-1234");
    const nope = await app.inject({ method: "GET", url: "/admin/stats", headers: authHeader(alvoToken) });
    expect(nope.statusCode).toBe(403);
  });
});
