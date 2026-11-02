// Configurações da instância editáveis em runtime (v12). Até a v11 o cadastro público só abria
// ou fechava pela variável ALLOW_REGISTRATION, o que exigia redeploy. Agora o admin decide na
// tela de Configurações; a variável de ambiente continua valendo como PADRÃO enquanto ninguém
// tiver salvo nada no banco.
//
// Cache em memória com validade curta: a rota de cadastro e a faixa de aviso leem isto a cada
// requisição, e o valor muda raramente. Em várias réplicas, a mudança chega às outras em até
// CACHE_MS; na réplica que gravou, na hora (o PATCH invalida o cache local).
import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { allowRegistration } from "../env.js";

const CACHE_MS = 15_000;

export const bannerSchema = z.object({
  message: z.string().trim().min(1).max(280),
  tone: z.enum(["info", "warning", "success"]).default("info"),
});

// domínio de e-mail: "ufg.br" ou "discente.ufg.br" (sem @, minúsculo, ao menos um ponto)
const domainSchema = z.string().trim().toLowerCase()
  .transform((d) => d.replace(/^@/, ""))
  .pipe(z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "domínio inválido (ex.: ufg.br)"));

export const settingsSchema = z.object({
  registrationOpen: z.boolean(),
  registrationDomains: z.array(domainSchema).max(20),
  banner: bannerSchema.nullable(),
});
export type InstanceSettings = z.infer<typeof settingsSchema>;
type Key = keyof InstanceSettings;

export const settingsPatchSchema = settingsSchema.partial().strict();

function defaults(): InstanceSettings {
  return { registrationOpen: allowRegistration, registrationDomains: [], banner: null };
}

let cache: { at: number; value: InstanceSettings; stored: Set<Key> } | null = null;

/** Lê as configurações efetivas (banco por cima dos padrões). */
export async function getSettings(prisma: PrismaClient): Promise<InstanceSettings> {
  return (await load(prisma)).value;
}

/** Quais chaves vieram do banco (o resto é padrão/ambiente) — a tela mostra a origem. */
export async function storedKeys(prisma: PrismaClient): Promise<Key[]> {
  return [...(await load(prisma)).stored];
}

async function load(prisma: PrismaClient) {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const rows = await prisma.instanceSetting.findMany();
  const value = defaults();
  const stored = new Set<Key>();
  for (const row of rows) {
    if (!(row.key in value)) continue; // chave antiga/desconhecida: ignora em vez de quebrar
    const key = row.key as Key;
    const raw = isOffMarker(row.value) ? null : row.value;
    const parsed = settingsSchema.shape[key].safeParse(raw);
    if (!parsed.success) continue;      // valor corrompido no banco: fica o padrão
    (value as Record<Key, unknown>)[key] = parsed.data;
    stored.add(key);
  }
  cache = { at: Date.now(), value, stored };
  return cache;
}

/** Grava só as chaves enviadas e devolve o estado efetivo novo. */
export async function updateSettings(
  prisma: PrismaClient, patch: Partial<InstanceSettings>, adminId: string,
): Promise<InstanceSettings> {
  const entries = Object.entries(patch) as [Key, InstanceSettings[Key]][];
  await prisma.$transaction(entries.map(([key, value]) =>
    prisma.instanceSetting.upsert({
      where: { key },
      // Json do Prisma não aceita `null` puro: a faixa desligada vira JsonNull
      update: { value: toJson(value), updatedBy: adminId },
      create: { key, value: toJson(value), updatedBy: adminId },
    })));
  cache = null;
  return getSettings(prisma);
}

// Coluna Json do Prisma não aceita `null` literal (exigiria Prisma.JsonNull/DbNull). A faixa
// desligada é gravada como um marcador explícito e volta a ser `null` na leitura.
const OFF = { off: true } as const;
function toJson(v: unknown): Prisma.InputJsonValue {
  return (v === null ? OFF : v) as Prisma.InputJsonValue;
}
function isOffMarker(v: unknown): boolean {
  return typeof v === "object" && v !== null && (v as { off?: unknown }).off === true;
}

/** O cadastro público aceita este e-mail? (lista vazia = qualquer domínio) */
export function emailDomainAllowed(email: string, domains: string[]): boolean {
  if (domains.length === 0) return true;
  const domain = email.split("@").pop()?.toLowerCase() ?? "";
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Só para testes: zera o cache entre casos. */
export function resetSettingsCache() { cache = null; }
