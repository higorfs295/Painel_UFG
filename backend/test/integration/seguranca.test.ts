// Camada extra de criptografia: a matrícula (PII) precisa sair decifrada pela API e ficar
// CIFRADA em repouso. O teste vale nos dois modos — com e sem FIELD_ENCRYPTION_KEY —, então
// não depende do ambiente: quando a chave está ativa, exige o prefixo "v1:" no banco.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, createUser, login, authHeader, uniqueEmail } from "./helpers.js";
import { fieldCryptoEnabled } from "../../src/lib/fieldCrypto.js";

let app: FastifyInstance;
beforeAll(async () => { app = await makeApp(); });
afterAll(async () => { await app.close(); });

describe("cifra de campo da matrícula (PII em repouso)", () => {
  it("API devolve em claro; o banco guarda cifrado quando há chave", async () => {
    const user = await createUser(app, { password: "senha-forte-123" });
    const { accessToken } = await login(app, user.email, "senha-forte-123");
    const MAT = "20240010999";

    const patch = await app.inject({
      method: "PATCH", url: "/me/settings",
      headers: authHeader(accessToken), payload: { matricula: MAT },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().matricula).toBe(MAT);           // decifrada na resposta

    const me = await app.inject({ method: "GET", url: "/me", headers: authHeader(accessToken) });
    expect(me.json().matricula).toBe(MAT);              // e na releitura

    // o que está gravado de fato
    const row = await app.prisma.user.findUniqueOrThrow({
      where: { id: user.id }, select: { matricula: true },
    });
    if (fieldCryptoEnabled) {
      expect(row.matricula).not.toBe(MAT);              // nunca em claro
      expect(row.matricula).toMatch(/^v1:/);            // formato versionado
    } else {
      expect(row.matricula).toBe(MAT);                  // modo transparente (sem chave)
    }
  });

  it("matrícula vazia limpa o campo", async () => {
    const user = await createUser(app, { password: "senha-forte-123" });
    const { accessToken } = await login(app, user.email, "senha-forte-123");
    await app.inject({
      method: "PATCH", url: "/me/settings",
      headers: authHeader(accessToken), payload: { matricula: "20240010000" },
    });
    const cleared = await app.inject({
      method: "PATCH", url: "/me/settings",
      headers: authHeader(accessToken), payload: { matricula: "" },
    });
    expect(cleared.json().matricula).toBeNull();
  });

  it("a listagem do admin também devolve a matrícula decifrada", async () => {
    const admin = await createUser(app, { role: "ADMIN", password: "senha-admin-123" });
    const alvo = await createUser(app, { password: "senha-alvo-1234" });
    const { accessToken: alvoTok } = await login(app, alvo.email, "senha-alvo-1234");
    await app.inject({
      method: "PATCH", url: "/me/settings",
      headers: authHeader(alvoTok), payload: { matricula: "20259999999" },
    });

    const { accessToken } = await login(app, admin.email, "senha-admin-123");
    const list = await app.inject({ method: "GET", url: "/users", headers: authHeader(accessToken) });
    const found = list.json().find((u: { id: string }) => u.id === alvo.id);
    expect(found.matricula).toBe("20259999999");
  });
});

describe("configuração exposta ao admin", () => {
  it("informa o ESTADO da cifra, nunca a chave", async () => {
    const admin = await createUser(app, { role: "ADMIN", password: "senha-admin-123" });
    const { accessToken } = await login(app, admin.email, "senha-admin-123");
    const res = await app.inject({ method: "GET", url: "/admin/config", headers: authHeader(accessToken) });
    const body = res.json();
    expect(body.security.fieldEncryption).toBe(fieldCryptoEnabled);
    expect(JSON.stringify(body)).not.toContain(process.env.FIELD_ENCRYPTION_KEY ?? "###sem-chave###");
  });
});

// Regressão de um vazamento real: o login e o cadastro buscavam a linha do usuário sem
// `select`, e o mapper público só trocava a matrícula — o hash argon2 da senha ia junto na
// resposta. A guarda cobre TODAS as bordas que devolvem usuário, não só a que quebrou.
describe("nenhuma borda expõe o hash da senha", () => {
  const semHash = (body: unknown, onde: string) =>
    expect(JSON.stringify(body), `${onde} vazou passwordHash`).not.toContain("passwordHash");

  it("cadastro, login, /me e a listagem do admin devolvem só a forma pública", async () => {
    const email = uniqueEmail("hash");
    const senha = "senha-super-forte";

    const registro = await app.inject({
      method: "POST", url: "/auth/register", payload: { name: "Sem Hash", email, password: senha },
    });
    // o cadastro público pode estar desligado na instância; nesse caso criamos direto
    if (registro.statusCode === 201) semHash(registro.json(), "POST /auth/register");
    else await createUser(app, { email, password: senha });

    const entrada = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: senha } });
    expect(entrada.statusCode).toBe(200);
    semHash(entrada.json(), "POST /auth/login");
    expect(entrada.json().user.passwordHash).toBeUndefined();

    const token = entrada.json().accessToken as string;
    semHash((await app.inject({ method: "GET", url: "/me", headers: authHeader(token) })).json(), "GET /me");

    const admin = await createUser(app, { role: "ADMIN", password: "senha-admin-123" });
    const { accessToken } = await login(app, admin.email, "senha-admin-123");
    semHash((await app.inject({ method: "GET", url: "/users", headers: authHeader(accessToken) })).json(), "GET /users");
  });
});
