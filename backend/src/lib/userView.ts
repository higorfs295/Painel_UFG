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
 * Campos que NUNCA saem da API, mesmo que o chamador tenha carregado a linha inteira.
 *
 * Isto não é redundância com `publicUserSelect`: quem busca com `findUnique` sem `select`
 * (o login e o cadastro faziam isso) recebe a linha completa, e um mapper que só troca a
 * matrícula deixaria o hash da senha passar direto para o cliente. Retirar aqui transforma
 * a convenção em garantia.
 */
const CAMPOS_PRIVADOS = ["passwordHash"] as const;

/**
 * Converte a linha do banco na forma pública: remove os campos privados e decifra a
 * matrícula. Genérico de propósito — preserva exatamente as demais colunas que o chamador
 * selecionou (com ou sem `createdAt`, com `enrollments` embutidas etc.).
 */
export function toPublicUser<T extends { matricula: string | null }>(
  user: T,
): Omit<T, "matricula" | (typeof CAMPOS_PRIVADOS)[number]> & { matricula: string | null } {
  const { matricula, ...rest } = user;
  for (const campo of CAMPOS_PRIVADOS) delete (rest as Record<string, unknown>)[campo];
  return { ...(rest as Omit<T, "matricula" | (typeof CAMPOS_PRIVADOS)[number]>), matricula: decryptField(matricula) };
}
