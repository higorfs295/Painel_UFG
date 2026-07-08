// Remove chaves com valor undefined. Necessário com exactOptionalPropertyTypes: os objetos
// parciais do zod tipam as chaves como `T | undefined`, e os inputs do Prisma não aceitam
// `undefined` explícito — a chave precisa estar ausente.
export function stripUndefined<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };
}
