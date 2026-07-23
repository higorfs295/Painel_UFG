// Alias de namespace (ver backend/src/app.ts): a API responde na raiz E sob
// API_ALIAS_PREFIX. O que este arquivo trava contra regressão:
//   1. os dois caminhos existem e devolvem o mesmo resultado;
//   2. o cookie de refresh é gravado com o path DO CAMINHO USADO — o erro clássico aqui é
//      fixar path=/auth e a sessão morrer no primeiro refresh feito via /api/auth/refresh;
//   3. uma sessão aberta pelo alias consegue renovar pelo alias;
//   4. o rate limit é UM só para os dois caminhos (o alias não pode dobrar o teto).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, createUser, uniqueEmail } from "./helpers.js";
import { API_ALIAS_PREFIX, env } from "../../src/env.js";

let app: FastifyInstance;
const SENHA = "senha-super-forte";
let email: string;

beforeAll(async () => {
  app = await makeApp();
  const user = await createUser(app, { email: uniqueEmail("ns"), password: SENHA });
  email = user.email;
});
afterAll(async () => { await app.close(); });

// Extrai o atributo path do Set-Cookie do refresh (nome do cookie: "rt").
function refreshCookiePathOf(res: Awaited<ReturnType<FastifyInstance["inject"]>>): string | undefined {
  return res.cookies.find((c) => c.name === "rt")?.path;
}

describe("alias de namespace (mesma origem sem colisão)", () => {
  it("o alias está ligado — senão o resto deste arquivo não faz sentido", () => {
    expect(API_ALIAS_PREFIX).toBe("/api");
  });

  it("/health responde nas duas montagens com o mesmo corpo", async () => {
    const raiz = await app.inject({ method: "GET", url: "/health" });
    const alias = await app.inject({ method: "GET", url: `${API_ALIAS_PREFIX}/health` });
    expect(raiz.statusCode).toBe(200);
    expect(alias.statusCode).toBe(200);
    expect(alias.json()).toEqual(raiz.json());
  });

  it("login funciona pela raiz e pelo alias", async () => {
    for (const base of ["", API_ALIAS_PREFIX]) {
      const res = await app.inject({
        method: "POST", url: `${base}/auth/login`, payload: { email, password: SENHA },
      });
      expect(res.statusCode, `login em ${base || "/"}`).toBe(200);
      expect(res.json()).toHaveProperty("accessToken");
    }
  });

  it("o cookie de refresh usa o path do caminho por onde a requisição entrou", async () => {
    const raiz = await app.inject({
      method: "POST", url: "/auth/login", payload: { email, password: SENHA },
    });
    expect(refreshCookiePathOf(raiz)).toBe("/auth");

    const alias = await app.inject({
      method: "POST", url: `${API_ALIAS_PREFIX}/auth/login`, payload: { email, password: SENHA },
    });
    // Se voltar "/auth", o navegador NÃO enviaria o cookie para /api/auth/refresh e a sessão
    // cairia no primeiro refresh — exatamente o bug que motivou este teste.
    expect(refreshCookiePathOf(alias)).toBe(`${API_ALIAS_PREFIX}/auth`);
  });

  it("uma sessão aberta pelo alias renova pelo alias", async () => {
    const loginRes = await app.inject({
      method: "POST", url: `${API_ALIAS_PREFIX}/auth/login`, payload: { email, password: SENHA },
    });
    const rt = loginRes.cookies.find((c) => c.name === "rt");
    expect(rt, "cookie de refresh emitido").toBeDefined();

    const res = await app.inject({
      method: "POST",
      url: `${API_ALIAS_PREFIX}/auth/refresh`,
      cookies: { rt: rt!.value },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("accessToken");
  });

  it("rota protegida exige autenticação nas duas montagens", async () => {
    for (const base of ["", API_ALIAS_PREFIX]) {
      const res = await app.inject({ method: "GET", url: `${base}/admin/stats` });
      expect(res.statusCode, `sem token em ${base || "/"}`).toBe(401);
    }
  });

  // O alias é implementado por REESCRITA (app.ts) justamente por causa disto: montar as
  // rotas duas vezes daria a cada caminho o seu próprio balde de rate limit, e o teto de
  // tentativas de login dobraria — 10 na raiz + 10 no alias. Aqui provamos que o balde é
  // um só: esgotado por um caminho, o outro já entra bloqueado.
  // 30s: cada login recusado gasta um argon2.hash (proposital, contra enumeração por timing),
  // e aqui são ~11 deles em série.
  it("o rate limit de login é COMPARTILHADO entre a raiz e o alias", { timeout: 30_000 }, async () => {
    const teto = env.AUTH_RATE_LIMIT_MAX;
    // o CI sobe o teto para 200 (a suíte E2E faz muitos logins); esgotar ali seria lento
    // e não provaria nada além do que já se prova com o teto padrão.
    if (teto > 20) return;

    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`; // IP só deste teste
    const tenta = (base: string) => app.inject({
      method: "POST", url: `${base}/auth/login`,
      payload: { email: uniqueEmail("rl"), password: "senha-que-nao-existe" },
      remoteAddress: ip,
    });

    let bloqueouNaRaiz = false;
    for (let i = 0; i < teto + 2 && !bloqueouNaRaiz; i++) {
      bloqueouNaRaiz = (await tenta("")).statusCode === 429;
    }
    expect(bloqueouNaRaiz, `o teto de ${teto} deveria ter bloqueado na raiz`).toBe(true);

    const noAlias = await tenta(API_ALIAS_PREFIX);
    expect(noAlias.statusCode, "o alias deveria herdar o bloqueio da raiz").toBe(429);
  });
});
