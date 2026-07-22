// Forma pública do usuário — um único lugar que decide o que a API expõe.
// Antes esse objeto era remontado à mão em auth (login/register), account (/me, PATCH settings)
// e users (listagem do admin); qualquer campo novo exigia lembrar dos três. Agora há um select
// canônico e um mapper que também DECIFRA a matrícula (cifrada em repouso, lib/fieldCrypto).
import { decryptField } from "./fieldCrypto.js";

/** Colunas seguras de User. Nunca inclua passwordHash aqui. */
export const publicUserSelect = {
  id: true, name: true, email: true, role: true, theme: true,
  matricula: true, shift: true, createdAt: true,
} as const;

/**
 * Converte a linha do banco na forma pública, decifrando a matrícula.
 * Genérico de propósito: preserva exatamente as colunas que o chamador selecionou
 * (com ou sem `createdAt`, com `enrollments` embutidas etc.), trocando só `matricula`.
 */
export function toPublicUser<T extends { matricula: string | null }>(
  user: T,
): Omit<T, "matricula"> & { matricula: string | null } {
  const { matricula, ...rest } = user;
  return { ...rest, matricula: decryptField(matricula) };
}
