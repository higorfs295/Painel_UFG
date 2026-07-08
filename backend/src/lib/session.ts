// Refresh tokens opacos, rotativos, armazenados só como hash (RF-03, RNF-01).
// Rotação a cada uso; reuso de um token já rotacionado/revogado revoga toda a família do usuário.
import type { PrismaClient } from "@prisma/client";
import { generateToken, hashToken } from "./crypto.js";
import { env } from "../env.js";

function expiryDate(): Date {
  return new Date(Date.now() + env.REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
}

// Emite um novo refresh, persiste o hash e devolve o token puro (vai para o cookie).
export async function issueRefreshToken(prisma: PrismaClient, userId: string): Promise<string> {
  const plain = generateToken();
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(plain), expiresAt: expiryDate() },
  });
  return plain;
}

export type RotationResult =
  | { ok: true; userId: string; plain: string }
  | { ok: false; reason: "invalid" | "expired" | "reuse" };

// Valida e rotaciona. Em caso de reuso (token já revogado apresentado de novo), revoga a família.
// O "claim" da rotação é ATÔMICO (update condicional em `revokedAt: null`): sob dois refresh
// concorrentes com o mesmo token, o lock de linha serializa e só UM vencedor emite o próximo token;
// o perdedor recebe `reuse`. Isso fecha a corrida de rotação (proliferação de tokens / bypass de reuso).
export async function rotateRefreshToken(prisma: PrismaClient, plain: string | undefined): Promise<RotationResult> {
  if (!plain) return { ok: false, reason: "invalid" };
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(plain) } });
  if (!row) return { ok: false, reason: "invalid" };

  if (row.revokedAt) {
    // token válido no passado, apresentado depois de revogado => vazamento. Revoga tudo do usuário.
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: false, reason: "reuse" };
  }
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };

  const nextPlain = generateToken();
  const userId = await prisma.$transaction(async (tx) => {
    // claim atômico: apenas quem conseguir revogar a linha ainda-não-revogada segue adiante.
    const claim = await tx.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claim.count === 0) return null; // corrida perdida: outro request já rotacionou este token
    await tx.refreshToken.create({
      data: { userId: row.userId, tokenHash: hashToken(nextPlain), expiresAt: expiryDate() },
    });
    return row.userId;
  });
  if (userId === null) return { ok: false, reason: "reuse" };
  return { ok: true, userId, plain: nextPlain };
}

// Expurgo de tokens de refresh vencidos/revogados antigos (a tabela cresce a cada login/rotação).
// Chame periodicamente (cron/scheduler). Devolve quantos foram removidos.
export async function pruneRefreshTokens(prisma: PrismaClient, olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const res = await prisma.refreshToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }] },
  });
  return res.count;
}

// Revoga um refresh específico (logout). Silencioso se não existir.
export async function revokeRefreshToken(prisma: PrismaClient, plain: string | undefined): Promise<void> {
  if (!plain) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(plain), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
