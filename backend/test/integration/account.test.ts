import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, createUser, login, uniqueSlug, authHeader } from "./helpers.js";
import { importCourse } from "../../src/domain/importCourse.js";

let app: FastifyInstance;
let courseSlug: string;
let subjBySeq: Map<number, string>;

const matriz = (slug: string) => ({
  course: { slug, name: "Curso Backup" },
  totalHours: 200,
  requirements: [{ key: "NC", label: "NC", hours: 100 }],
  milestones: [],
  subjects: [
    { seq: 1, code: "B1", name: "Um", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
    { seq: 2, code: "B2", name: "Dois", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
  ],
});

beforeAll(async () => {
  app = await makeApp();
  courseSlug = uniqueSlug();
  await importCourse(app.prisma, matriz(courseSlug));
  const course = await app.prisma.course.findUniqueOrThrow({ where: { slug: courseSlug } });
  const subs = await app.prisma.subject.findMany({ where: { courseId: course.id }, select: { id: true, seq: true } });
  subjBySeq = new Map(subs.map(s => [s.seq, s.id]));
});
afterAll(async () => { await app.close(); });

async function enrolledUser() {
  const user = await createUser(app, { password: "senha-forte-123" });
  const course = await app.prisma.course.findUniqueOrThrow({ where: { slug: courseSlug } });
  const enr = await app.prisma.enrollment.create({ data: { userId: user.id, courseId: course.id } });
  const { accessToken } = await login(app, user.email, "senha-forte-123");
  return { user, enr, accessToken };
}

describe("perfil e tema (RF-15)", () => {
  it("GET /me retorna o perfil; PATCH /me/settings troca o tema", async () => {
    const { accessToken } = await enrolledUser();
    const me = await app.inject({ method: "GET", url: "/me", headers: authHeader(accessToken) });
    expect(me.statusCode).toBe(200);
    expect(me.json().theme).toBe("dark");

    const patch = await app.inject({
      method: "PATCH", url: "/me/settings", headers: authHeader(accessToken), payload: { theme: "light" },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().theme).toBe("light");
  });
});

describe("backup export/import (RF-16)", () => {
  it("roundtrip: exporta, apaga tudo, reimporta e reconstrói o estado", async () => {
    const { enr, accessToken } = await enrolledUser();
    // estado inicial: 1 aprovada + 1 extra + tema light
    await app.inject({ method: "PUT", url: `/me/enrollments/${enr.id}/subjects/${subjBySeq.get(1)}`, headers: authHeader(accessToken), payload: { state: "APPROVED" } });
    await app.inject({ method: "POST", url: `/me/enrollments/${enr.id}/extras`, headers: authHeader(accessToken), payload: { name: "Curso Extra", hours: 40, category: "NL", status: "DONE" } });
    await app.inject({ method: "PATCH", url: "/me/settings", headers: authHeader(accessToken), payload: { theme: "light" } });

    const exp = await app.inject({ method: "GET", url: "/me/export", headers: authHeader(accessToken) });
    expect(exp.statusCode).toBe(200);
    const backup = exp.json();
    expect(backup.version).toBe(1);
    expect(backup.enrollments[0].subjects).toHaveLength(1);
    expect(backup.enrollments[0].extras).toHaveLength(1);

    // apaga tudo
    await app.inject({ method: "PUT", url: `/me/enrollments/${enr.id}/subjects/${subjBySeq.get(1)}`, headers: authHeader(accessToken), payload: { state: null } });
    const extras = await app.inject({ method: "GET", url: `/me/enrollments/${enr.id}/extras`, headers: authHeader(accessToken) });
    for (const x of extras.json()) await app.inject({ method: "DELETE", url: `/me/extras/${x.id}`, headers: authHeader(accessToken) });

    // reimporta
    const imp = await app.inject({ method: "POST", url: "/me/import", headers: authHeader(accessToken), payload: backup });
    expect(imp.statusCode).toBe(200);
    expect(imp.json().restored).toBe(1);

    // estado reconstruído (total limitado: NC conta 100; NL sem mínimo no curso -> conta 0)
    const prog = await app.inject({ method: "GET", url: `/me/enrollments/${enr.id}/progress`, headers: authHeader(accessToken) });
    expect(prog.json().totals.hours).toBe(100);
    // mas o extra NL existe e é visível na lista
    const extrasRes = await app.inject({ method: "GET", url: `/me/enrollments/${enr.id}/extras`, headers: authHeader(accessToken) });
    expect(extrasRes.json()).toHaveLength(1);
  });

  it("ignora cursos inexistentes no servidor sem quebrar", async () => {
    const { accessToken } = await enrolledUser();
    const fake = { version: 1, user: { theme: "dark" }, enrollments: [{ courseSlug: "curso-que-nao-existe", subjects: [], extras: [], scenarios: [] }] };
    const imp = await app.inject({ method: "POST", url: "/me/import", headers: authHeader(accessToken), payload: fake });
    expect(imp.statusCode).toBe(200);
    expect(imp.json().skippedCourses).toContain("curso-que-nao-existe");
  });
});
