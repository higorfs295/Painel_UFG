// RNF-05: autorização por posse. Toda rota sob /me confirma no servidor que o recurso
// pertence ao usuário autenticado antes de ler/gravar.
import type { PrismaClient } from "@prisma/client";

export class OwnershipError extends Error {
  constructor(public status: 403 | 404, message: string) { super(message); }
}

export async function assertEnrollmentOwner(prisma: PrismaClient, enrollmentId: string, userId: string) {
  const enr = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enr) throw new OwnershipError(404, "enrollment não encontrado");
  if (enr.userId !== userId) throw new OwnershipError(403, "recurso de outro usuário");
  return enr;
}

export async function assertExtraOwner(prisma: PrismaClient, extraId: string, userId: string) {
  const extra = await prisma.extraComponent.findUnique({
    where: { id: extraId }, include: { enrollment: true },
  });
  if (!extra) throw new OwnershipError(404, "componente não encontrado");
  if (extra.enrollment.userId !== userId) throw new OwnershipError(403, "recurso de outro usuário");
  return extra;
}

export async function assertScenarioOwner(prisma: PrismaClient, scenarioId: string, userId: string) {
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId }, include: { enrollment: true },
  });
  if (!scenario) throw new OwnershipError(404, "cenário não encontrado");
  if (scenario.enrollment.userId !== userId) throw new OwnershipError(403, "recurso de outro usuário");
  return scenario;
}
