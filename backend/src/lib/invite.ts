// Convites e reset de senha: token aleatório de uso único, guardado como hash, com expiração.
// O valor puro só é devolvido uma vez (no link). RF-01/02/04, RNF-01.
import type { PrismaClient } from "@prisma/client";
import { generateToken, hashToken } from "./crypto.js";
import { env } from "../env.js";

export type InvitePurpose = "SET_PASSWORD" | "RESET_PASSWORD";

// Cria o token e devolve o link pronto para o admin repassar (ou para o e-mail de reset).
export async function issueInvite(
  prisma: PrismaClient, userId: string, purpose: InvitePurpose = "SET_PASSWORD",
): Promise<{ token: string; link: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + env.INVITE_EXPIRES_HOURS * 60 * 60 * 1000);
  await prisma.inviteToken.create({
    data: { userId, tokenHash: hashToken(token), purpose, expiresAt },
  });
  const path = purpose === "RESET_PASSWORD" ? "reset" : "convite";
  return { token, link: `${env.APP_URL}/${path}/${token}`, expiresAt };
}

// Valida um token de convite/reset: existe, não usado, não expirado. Retorna a linha ou null.
export async function consumeInvite(prisma: PrismaClient, token: string) {
  const row = await prisma.inviteToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}
