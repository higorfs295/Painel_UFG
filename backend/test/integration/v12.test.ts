// v12: aparência por usuário, configurações da instância em runtime, avisos agendados/por curso,
// Visão do sistema, relatório agregado com supressão de grupos pequenos, ferramentas de usuários,
// matriz como arquivo (exportar/pré-visualizar/editar), busca na auditoria e linha do tempo.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, createUser, login, uniqueEmail, uniqueSlug, authHeader } from "./helpers.js";
import { importCourse } from "../../src/domain/importCourse.js";

let app: FastifyInstance;
let courseSlug: string;
let courseId: string;
let subjectIds: string[] = [];

const matriz = (slug: string) => ({
  course: { slug, name: "Curso v12" },
  totalHours: 300,
  requirements: [{ key: "NC", label: "Núcleo Comum", hours: 300 }],
  milestones: [{ key: "CH1", hours: 100, description: "primeiro marco" }],
  subjects: [
    { seq: 1, code: "V1", name: "Base", hours: 100, nucleus: "NC", groupOpt: 0, pre: [], co: [] },
    { seq: 2, code: "V2", name: "Meio", hours: 100, nucleus: "NC", groupOpt: 0, pre: [1], co: [] },
    { seq: 3, code: "V3", name: "Fim", hours: 100, nucleus: "NC", groupOpt: 0, pre: [2], co: [] },
  ],
});

const tokenFor = (u: { id: string; role: "ADMIN" | "USER" }) => app.jwt.sign({ sub: u.id, role: u.role });

async function admin() {
  const user = await createUser(app, { role: "ADMIN", password: "senha-admin-123" });
  return { user, h: authHeader(tokenFor(user)) };
}
async function student(enroll = true) {
  const user = await createUser(app, { password: "senha-forte-123" });
  const enr = enroll ? await app.prisma.enrollment.create({ data: { userId: user.id, courseId } }) : null;
  return { user, enr, h: authHeader(tokenFor(user)) };
}

beforeAll(async () => {
  app = await makeApp();
  courseSlug = uniqueSlug("v12");
  await importCourse(app.prisma, matriz(courseSlug));
  const course = await app.prisma.course.findUniqueOrThrow({ where: { slug: courseSlug } });
  courseId = course.id;
  subjectIds = (await app.prisma.subject.findMany({ where: { courseId }, orderBy: { seq: "asc" } })).map((s) => s.id);
});
afterAll(async () => {
  // as configurações da instância são globais: devolve os padrões para os outros arquivos
  await app.prisma.instanceSetting.deleteMany();
  await app.close();
});

describe("aparência por usuário", () => {
  it("salva cor de destaque e barra lateral, recusa valores fora da lista e leva no backup", async () => {
    const { h } = await student(false);
    const me = await app.inject({ method: "GET", url: "/me", headers: h });
    expect(me.json()).toMatchObject({ accent: "orange", sidebar: "light" });

    const ok = await app.inject({ method: "PATCH", url: "/me/settings", headers: h, payload: { accent: "violet", sidebar: "color" } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ accent: "violet", sidebar: "color" });

    for (const payload of [{ accent: "yellow" }, { sidebar: "glass" }]) {
      const bad = await app.inject({ method: "PATCH", url: "/me/settings", headers: h, payload });
      expect(bad.statusCode).toBe(400);
    }

    const backup = (await app.inject({ method: "GET", url: "/me/export", headers: h })).json();
    expect(backup.user).toMatchObject({ accent: "violet", sidebar: "color" });
  });
});

describe("configurações da instância", () => {
  it("fecha o cadastro em runtime, restringe domínio e publica a faixa de aviso", async () => {
    const { h } = await admin();
    const { h: sh } = await student(false);

    expect((await app.inject({ method: "PATCH", url: "/admin/settings", headers: sh, payload: { registrationOpen: false } })).statusCode).toBe(403);
    expect((await app.inject({ method: "PATCH", url: "/admin/settings", headers: h, payload: { registrationDomains: ["não é domínio"] } })).statusCode).toBe(400);

    const closed = await app.inject({ method: "PATCH", url: "/admin/settings", headers: h, payload: { registrationOpen: false } });
    expect(closed.json().settings.registrationOpen).toBe(false);
    expect(closed.json().stored).toContain("registrationOpen");
    const denied = await app.inject({
      method: "POST", url: "/auth/register",
      payload: { name: "Fulano", email: uniqueEmail(), password: "senha-super-forte" },
    });
    expect(denied.statusCode).toBe(403);

    await app.inject({
      method: "PATCH", url: "/admin/settings", headers: h,
      payload: { registrationOpen: true, registrationDomains: ["@Discente.UFG.br"], banner: { message: "Manutenção às 22h", tone: "warning" } },
    });
    const pub = (await app.inject({ method: "GET", url: "/settings/public" })).json();
    expect(pub).toMatchObject({ registrationOpen: true, registrationDomains: ["discente.ufg.br"], banner: { tone: "warning" } });

    const wrongDomain = await app.inject({
      method: "POST", url: "/auth/register",
      payload: { name: "Fulano", email: uniqueEmail(), password: "senha-super-forte" },
    });
    expect(wrongDomain.statusCode).toBe(403);
    expect(wrongDomain.json().domains).toEqual(["discente.ufg.br"]);
    const rightDomain = await app.inject({
      method: "POST", url: "/auth/register",
      payload: { name: "Fulana", email: `v12.${Date.now()}@discente.ufg.br`, password: "senha-super-forte" },
    });
    expect(rightDomain.statusCode).toBe(201);

    const off = await app.inject({ method: "PATCH", url: "/admin/settings", headers: h, payload: { banner: null, registrationDomains: [] } });
    expect(off.json().settings.banner).toBeNull();
    expect((await app.inject({ method: "GET", url: "/settings/public" })).json().banner).toBeNull();
  });
});

describe("avisos agendados, com validade e por curso", () => {
  it("o feed só mostra o que está no ar, da audiência e do curso de quem lê", async () => {
    const { h } = await admin();
    const { h: inCourse } = await student(true);
    const { h: outside } = await student(false);
    const hour = 3_600_000;
    const post = (payload: object) => app.inject({ method: "POST", url: "/admin/announcements", headers: h, payload });

    const targeted = await post({ title: "Só do curso", body: "x", courseSlug });
    const future = await post({ title: "Amanhã", body: "x", publishAt: new Date(Date.now() + 24 * hour).toISOString() });
    const old = await post({ title: "Vencido", body: "x", publishAt: new Date(Date.now() - 3 * hour).toISOString(), expiresAt: new Date(Date.now() - hour).toISOString() });
    expect([targeted.statusCode, future.statusCode, old.statusCode]).toEqual([201, 201, 201]);
    expect(future.json().status).toBe("scheduled");
    expect(old.json().status).toBe("expired");
    expect(targeted.json().course.slug).toBe(courseSlug);

    const titles = async (hh: Record<string, string>) =>
      ((await app.inject({ method: "GET", url: "/announcements?limit=50", headers: hh })).json() as { title: string }[]).map((a) => a.title);
    const mine = await titles(inCourse);
    expect(mine).toContain("Só do curso");
    expect(mine).not.toContain("Amanhã");
    expect(mine).not.toContain("Vencido");
    expect(await titles(outside)).not.toContain("Só do curso");

    const badWindow = await post({ title: "Errado", body: "x", expiresAt: new Date(Date.now() - hour).toISOString() });
    expect(badWindow.statusCode).toBe(400);
    expect((await post({ title: "Curso fantasma", body: "x", courseSlug: "nao-existe" })).statusCode).toBe(400);

    for (const r of [targeted, future, old])
      await app.inject({ method: "DELETE", url: `/admin/announcements/${r.json().id}`, headers: h });
  });

  it("admin que também cursa recebe os avisos de alunos", async () => {
    const { user, h } = await admin();
    const { h: ah } = await admin();
    const a = await app.inject({ method: "POST", url: "/admin/announcements", headers: ah, payload: { title: "Para alunos v12", body: "x", audience: "STUDENTS" } });
    const feed = async () => ((await app.inject({ method: "GET", url: "/announcements?limit=50", headers: h })).json() as { title: string }[]).map((x) => x.title);
    expect(await feed()).not.toContain("Para alunos v12");
    await app.inject({ method: "POST", url: "/me/enrollments", headers: h, payload: { courseSlug } });
    expect(await app.prisma.enrollment.count({ where: { userId: user.id } })).toBe(1);
    expect(await feed()).toContain("Para alunos v12");
    await app.inject({ method: "DELETE", url: `/admin/announcements/${a.json().id}`, headers: ah });
  });
});

describe("visão do sistema e relatório agregado", () => {
  it("devolve séries completas e só para admin", async () => {
    const { h } = await admin();
    const { h: sh } = await student(false);
    expect((await app.inject({ method: "GET", url: "/admin/analytics", headers: sh })).statusCode).toBe(403);
    const res = await app.inject({ method: "GET", url: "/admin/analytics", headers: h });
    expect(res.statusCode).toBe(200);
    const a = res.json();
    expect(a.signupsByWeek).toHaveLength(12);
    expect(a.loginsByDay).toHaveLength(182);
    expect(a.users.total).toBeGreaterThan(0);
    expect(a.courses.some((c: { slug: string }) => c.slug === courseSlug)).toBe(true);
  });

  it("some com menos de 5 alunos e, com 5+, só traz agregados (nenhum dado de aluno)", async () => {
    const { h } = await admin();
    const slug = uniqueSlug("rel");
    await importCourse(app.prisma, matriz(slug));
    const course = await app.prisma.course.findUniqueOrThrow({ where: { slug } });
    const subs = await app.prisma.subject.findMany({ where: { courseId: course.id }, orderBy: { seq: "asc" } });

    const users = [];
    for (let i = 0; i < 4; i += 1) {
      const u = await createUser(app, { password: null });
      users.push(u);
      await app.prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, startTerm: "2024.1" } });
    }
    const small = (await app.inject({ method: "GET", url: `/admin/reports/courses/${slug}`, headers: h })).json();
    expect(small).toMatchObject({ students: 4, minGroup: 5, suppressed: true });
    expect(small.subjects).toBeUndefined();

    const fifth = await createUser(app, { password: null });
    users.push(fifth);
    const enr = await app.prisma.enrollment.create({ data: { userId: fifth.id, courseId: course.id } });
    // um aluno aprovou a disciplina 1 (100 de 300h) e está cursando a 2
    await app.prisma.subjectStatus.createMany({ data: [
      { enrollmentId: enr.id, subjectId: subs[0]!.id, state: "APPROVED", grade: 9.5 },
      { enrollmentId: enr.id, subjectId: subs[1]!.id, state: "ENROLLED" },
    ] });

    const res = await app.inject({ method: "GET", url: `/admin/reports/courses/${slug}`, headers: h });
    const r = res.json();
    expect(r.suppressed).toBe(false);
    expect(r.students).toBe(5);
    expect(r.progress.histogram.reduce((s: number, b: { count: number }) => s + b.count, 0)).toBe(5);
    const base = r.subjects.find((s: { seq: number }) => s.seq === 1);
    expect(base).toMatchObject({ approved: 1, apt: 4, pending: 4, unlocks: 2 });
    expect(r.subjects.find((s: { seq: number }) => s.seq === 2).enrolled).toBe(1);
    expect(r.cohorts).toEqual([{ term: "2024.1", count: 4 }, { term: "não informado", count: 1 }]);
    // nada que identifique alguém nem nota alguma
    const raw = res.body;
    for (const u of users) { expect(raw).not.toContain(u.id); expect(raw).not.toContain(u.email); }
    expect(raw).not.toContain(enr.id);
    expect(raw).not.toContain("9.5");
  });
});

describe("ferramentas de usuários", () => {
  it("lista último acesso e sessões, edita cadastro e encerra sessões de outra conta", async () => {
    const { user: me, h } = await admin();
    const target = await createUser(app, { password: "senha-forte-123" });
    await login(app, target.email, "senha-forte-123");

    const list = (await app.inject({ method: "GET", url: "/users", headers: h })).json() as { id: string; lastLoginAt: string | null; sessions: number }[];
    const row = list.find((u) => u.id === target.id)!;
    expect(row.lastLoginAt).not.toBeNull();
    expect(row.sessions).toBeGreaterThan(0);

    const patch = await app.inject({ method: "PATCH", url: `/users/${target.id}`, headers: h, payload: { matricula: "202400123", shift: "noturno" } });
    expect(patch.statusCode).toBe(200);
    const stored = await app.prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.shift).toBe("noturno");
    const trail = await app.prisma.auditLog.findFirstOrThrow({ where: { action: "user.update", entityId: target.id } });
    expect(JSON.stringify(trail.meta)).not.toContain("202400123"); // PII fica fora da trilha

    expect((await app.inject({ method: "POST", url: `/users/${me.id}/sessions/revoke`, headers: h })).statusCode).toBe(400);
    const revoked = await app.inject({ method: "POST", url: `/users/${target.id}/sessions/revoke`, headers: h });
    expect(revoked.json().revoked).toBeGreaterThan(0);
    expect(await app.prisma.refreshToken.count({ where: { userId: target.id, revokedAt: null } })).toBe(0);
  });

  it("importa em lote e informa o resultado de cada linha", async () => {
    const { h } = await admin();
    const existing = await createUser(app);
    const fresh = uniqueEmail("lote");
    const res = await app.inject({
      method: "POST", url: "/users/import", headers: h,
      payload: { users: [
        { name: "Aluna Nova", email: fresh, courseSlug },
        { name: "Repetido", email: existing.email },
        { name: "X", email: "sem-arroba" },
        { name: "Curso errado", email: uniqueEmail("lote"), courseSlug: "nao-existe" },
      ] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.created).toBe(1);
    expect(body.results.map((r: { status: string }) => r.status)).toEqual(["created", "exists", "error", "error"]);
    expect(body.results[0].invite.link).toContain("/convite/");
    const created = await app.prisma.user.findUniqueOrThrow({ where: { email: fresh }, include: { enrollments: true } });
    expect(created.passwordHash).toBeNull();
    expect(created.enrollments).toHaveLength(1);
  });
});

describe("matriz como arquivo", () => {
  it("exporta no formato da importação, pré-visualiza mudanças sem gravar e edita o cabeçalho", async () => {
    const { h } = await admin();
    const exp = await app.inject({ method: "GET", url: `/courses/${courseSlug}/export`, headers: h });
    expect(exp.statusCode).toBe(200);
    const m = exp.json();
    expect(m).toMatchObject({ course: { slug: courseSlug }, totalHours: 300 });
    expect(m.subjects.find((s: { seq: number }) => s.seq === 3).pre).toEqual([2]);

    const edited = { ...m, subjects: [...m.subjects.map((s: { seq: number; name: string }) => (s.seq === 1 ? { ...s, name: "Base renomeada" } : s)).filter((s: { seq: number }) => s.seq !== 3),
      { seq: 9, code: "V9", name: "Nova", hours: 50, nucleus: "NC", groupOpt: 0, pre: [42], co: [] }] };
    const prev = await app.inject({ method: "POST", url: "/courses/import?dryRun=1", headers: h, payload: edited });
    expect(prev.json()).toMatchObject({ valid: true, exists: true, added: [9], changed: [1], missing: [3] });
    expect(prev.json().orphans).toEqual([{ seq: 9, ref: 42 }]);
    // nada foi gravado
    expect((await app.prisma.subject.findFirstOrThrow({ where: { courseId, seq: 1 } })).name).toBe("Base");

    const invalid = await app.inject({ method: "POST", url: "/courses/import?dryRun=1", headers: h, payload: { course: { slug: "" } } });
    expect(invalid.json().valid).toBe(false);
    expect(invalid.json().errors.length).toBeGreaterThan(0);

    const patched = await app.inject({ method: "PATCH", url: `/courses/${courseSlug}`, headers: h, payload: { name: "Curso v12 editado", totalHours: 320 } });
    expect(patched.json()).toMatchObject({ name: "Curso v12 editado", totalHours: 320 });

    // reimportar o export não muda nada (idempotência do par exportar/importar)
    await app.inject({ method: "PATCH", url: `/courses/${courseSlug}`, headers: h, payload: { name: "Curso v12", totalHours: 300 } });
    const again = await app.inject({ method: "POST", url: "/courses/import?dryRun=1", headers: h, payload: m });
    expect(again.json()).toMatchObject({ added: [], changed: [], missing: [] });
  });
});

describe("auditoria e monitor", () => {
  it("busca por quem fez, pagina por cursor e lista as ações", async () => {
    const { user, h } = await admin();
    await app.inject({ method: "PATCH", url: `/courses/${courseSlug}`, headers: h, payload: { name: "Curso v12" } });
    await app.inject({ method: "PATCH", url: `/courses/${courseSlug}`, headers: h, payload: { totalHours: 300 } });

    const found = (await app.inject({ method: "GET", url: `/admin/audit?q=${encodeURIComponent(user.email)}&limit=1`, headers: h })).json();
    expect(found.entries).toHaveLength(1);
    expect(found.entries[0].userId).toBe(user.id);
    expect(found.nextBefore).not.toBeNull();
    const page2 = (await app.inject({ method: "GET", url: `/admin/audit?q=${encodeURIComponent(user.email)}&limit=1&before=${found.nextBefore}`, headers: h })).json();
    expect(page2.entries[0].id).not.toBe(found.entries[0].id);

    const actions = (await app.inject({ method: "GET", url: "/admin/audit/actions", headers: h })).json().actions as { action: string }[];
    expect(actions.some((a) => a.action === "course.update")).toBe(true);

    const metrics = (await app.inject({ method: "GET", url: "/admin/metrics", headers: h })).json();
    expect(metrics.http.timeline).toHaveLength(60);
    expect(metrics.http.timeline.at(-1).count).toBeGreaterThan(0);
  });
});
