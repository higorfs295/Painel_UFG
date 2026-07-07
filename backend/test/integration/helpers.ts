// Utilitários compartilhados pelos testes de integração: app único, criação de usuário e login.
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

export async function makeApp(): Promise<FastifyInstance> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Testes de integração exigem DATABASE_URL (Postgres migrado). " +
      "Suba o banco (docker compose up -d db), rode `npm run migrate` e tente de novo.",
    );
  }
  const app = await buildApp();
  await app.ready();
  return app;
}

export const uniqueEmail = (p = "user") => `${p}.${randomBytes(6).toString("hex")}@test.local`;
export const uniqueSlug = (p = "curso") => `${p}-${randomBytes(6).toString("hex")}`;

export async function createUser(
  app: FastifyInstance,
  opts: { role?: "ADMIN" | "USER"; password?: string | null; email?: string; name?: string } = {},
) {
  const email = opts.email ?? uniqueEmail();
  const password = opts.password === undefined ? "senha-super-forte" : opts.password;
  return app.prisma.user.create({
    data: {
      name: opts.name ?? "Teste",
      email,
      role: opts.role ?? "USER",
      passwordHash: password ? await argon2.hash(password) : null,
    },
  });
}

// Faz login via HTTP e devolve o accessToken + o cookie de refresh para reuso nas próximas chamadas.
export async function login(app: FastifyInstance, email: string, password: string) {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`login falhou (${res.statusCode}): ${res.body}`);
  const body = res.json() as { accessToken: string };
  const setCookie = res.cookies.find(c => c.name === "rt");
  return { accessToken: body.accessToken, refreshCookie: setCookie ? `rt=${setCookie.value}` : "" };
}

export const authHeader = (token: string) => ({ authorization: `Bearer ${token}` });
