import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, createUser, login, uniqueEmail } from "./helpers.js";
import { issueInvite } from "../../src/lib/invite.js";

let app: FastifyInstance;
beforeAll(async () => { app = await makeApp(); });
afterAll(async () => { await app.close(); });

describe("fluxo de convite (RF-01/02)", () => {
  it("usuário sem senha define a própria via token e passa a logar", async () => {
    const user = await createUser(app, { password: null, email: uniqueEmail("invite") });
    const { token } = await issueInvite(app.prisma, user.id, "SET_PASSWORD");

    // login antes de definir senha falha
    const pre = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password: "qualquer-coisa" } });
    expect(pre.statusCode).toBe(401);

    const accept = await app.inject({ method: "POST", url: "/auth/invite/accept", payload: { token, password: "nova-senha-forte" } });
    expect(accept.statusCode).toBe(204);

    const { accessToken } = await login(app, user.email, "nova-senha-forte");
    expect(accessToken).toBeTruthy();
  });

  it("token de convite é de uso único", async () => {
    const user = await createUser(app, { password: null });
    const { token } = await issueInvite(app.prisma, user.id);
    const first = await app.inject({ method: "POST", url: "/auth/invite/accept", payload: { token, password: "senha-forte-123" } });
    expect(first.statusCode).toBe(204);
    const second = await app.inject({ method: "POST", url: "/auth/invite/accept", payload: { token, password: "outra-senha-123" } });
    expect(second.statusCode).toBe(400);
  });
});

describe("login e sessão (RF-03)", () => {
  it("credenciais inválidas => 401 uniforme", async () => {
    const user = await createUser(app, { password: "certa-senha-123" });
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password: "errada" } });
    expect(res.statusCode).toBe(401);
  });

  it("access token autoriza rota protegida", async () => {
    const user = await createUser(app, { password: "certa-senha-123" });
    const { accessToken } = await login(app, user.email, "certa-senha-123");
    const ok = await app.inject({ method: "GET", url: "/me/enrollments", headers: { authorization: `Bearer ${accessToken}` } });
    expect(ok.statusCode).toBe(200);
    const nope = await app.inject({ method: "GET", url: "/me/enrollments" });
    expect(nope.statusCode).toBe(401);
  });

  it("refresh rotaciona e detecta reuso do token antigo", async () => {
    const user = await createUser(app, { password: "certa-senha-123" });
    const { refreshCookie } = await login(app, user.email, "certa-senha-123");

    // primeira rotação: ok, devolve novo cookie
    const r1 = await app.inject({ method: "POST", url: "/auth/refresh", headers: { cookie: refreshCookie } });
    expect(r1.statusCode).toBe(200);

    // reusar o cookie ANTIGO (já rotacionado) => 401 com reason "reuse"
    const reuse = await app.inject({ method: "POST", url: "/auth/refresh", headers: { cookie: refreshCookie } });
    expect(reuse.statusCode).toBe(401);
    expect(reuse.json()).toMatchObject({ reason: "reuse" });

    // e o cookie NOVO também é invalidado (família revogada)
    const newCookie = `rt=${r1.cookies.find(c => c.name === "rt")!.value}`;
    const afterReuse = await app.inject({ method: "POST", url: "/auth/refresh", headers: { cookie: newCookie } });
    expect(afterReuse.statusCode).toBe(401);
  });
});
