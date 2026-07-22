// RF-27 — trilha de auditoria: registra ações sensíveis (login, papéis, imports, calendário).
// NUNCA lança: auditoria indisponível não pode derrubar o fluxo principal (best-effort).
// Nunca grave segredos em `meta` (senhas, tokens) — apenas identificadores e contexto.
import type { PrismaClient, Prisma } from "@prisma/client";

export type AuditEntry = {
  userId?: string | null;
  action: string;                // "auth.login", "auth.login_failed", "user.role", "course.import"...
  entity?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
  ip?: string;
};

export async function audit(prisma: PrismaClient, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        ip: entry.ip ?? null,
        // `meta` é Json opcional: com exactOptionalPropertyTypes a chave só pode existir se definida
        ...(entry.meta !== undefined ? { meta: entry.meta } : {}),
      },
    });
  } catch {
    /* best-effort: nunca propaga */
  }
}
