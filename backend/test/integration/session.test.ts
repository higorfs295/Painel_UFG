import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, createUser } from "./helpers.js";
import { issueRefreshToken, rotateRefreshToken, pruneRefreshTokens } from "../../src/lib/session.js";
import { hashToken } from "../../src/lib/crypto.js";

let app: FastifyInstance;
beforeAll(async () => { app = await makeApp(); });
afterAll(async () => { await app.close(); });

describe("rotação de refresh sob concorrência", () => {
  it("dois refresh concorrentes com o mesmo token: só UM vence, o outro é reuse", async () => {
    const user = await createUser(app, { password: "senha-forte-123" });
    const token = await issueRefreshToken(app.prisma, user.id);

    const [a, b] = await Promise.all([
      rotateRefreshToken(app.prisma, token),
      rotateRefreshToken(app.prisma, token),
    ]);

    const okCount = [a, b].filter((r) => r.ok).length;
    expect(okCount).toBe(1); // exatamente um vencedor — sem proliferação de tokens
    expect([a, b].some((r) => !r.ok && r.reason === "reuse")).toBe(true);

    // após a rotação, deve existir exatamente 1 token ativo (não revogado) para o usuário
    const active = await app.prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(1);
  });

  it("reuso de um token já revogado revoga toda a família", async () => {
    const user = await createUser(app, { password: "senha-forte-123" });
    const t1 = await issueRefreshToken(app.prisma, user.id);
    const r1 = await rotateRefreshToken(app.prisma, t1); // t1 -> t2 (t1 revogado)
    expect(r1.ok).toBe(true);
    const reuse = await rotateRefreshToken(app.prisma, t1); // apresenta t1 de novo
    expect(reuse.ok).toBe(false);
    const active = await app.prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(0); // família revogada
  });
});

describe("expurgo de tokens", () => {
  it("remove vencidos e revogados antigos", async () => {
    const user = await createUser(app, { password: "senha-forte-123" });
    // token vencido
    await app.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hashToken("vencido-" + user.id), expiresAt: new Date(Date.now() - 1000) },
    });
    const removed = await pruneRefreshTokens(app.prisma, 30);
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});
