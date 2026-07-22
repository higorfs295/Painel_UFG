// Camada extra de criptografia: cifra de CAMPO em repouso (AES-256-GCM) para PII que o banco
// guarda em claro — hoje o número de matrícula do aluno.
//
// Por que além do TLS e do hash de senha:
//  · TLS protege em trânsito; isto protege o DADO EM REPOUSO (dump, backup, réplica vazada);
//  · senha usa argon2 (hash, via única) — matrícula precisa ser LIDA de volta, então é cifra
//    simétrica autenticada, não hash.
//
// Formato: "v1:<iv-base64url>:<tag-base64url>:<ciphertext-base64url>".
// O prefixo de versão permite rotação/rekey futura e convivência com dados legados em claro:
// valores sem o prefixo são devolvidos como estão (retrocompatível).
//
// Chave: FIELD_ENCRYPTION_KEY — 32 bytes em base64 ou hex. Ausente => modo transparente
// (grava/lê em claro), para não travar instalações existentes; o /admin/config expõe o estado.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;   // recomendado para GCM
const KEY_BYTES = 32;  // AES-256

function parseKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== KEY_BYTES) {
    throw new Error(`FIELD_ENCRYPTION_KEY deve ter ${KEY_BYTES} bytes (64 hex ou 44 base64).`);
  }
  return buf;
}

// Resolvida uma vez no import: chave inválida deve derrubar o boot, não uma request no meio.
let key: Buffer | null = null;
try {
  key = parseKey(process.env.FIELD_ENCRYPTION_KEY);
} catch (err) {
  // relança com contexto — o servidor não deve subir com chave malformada
  throw err instanceof Error ? err : new Error(String(err));
}

export const fieldCryptoEnabled = key !== null;

const b64 = (b: Buffer) => b.toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url");

/** Cifra um valor para gravar. Sem chave configurada, devolve o texto original (modo transparente). */
export function encryptField(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  if (!key) return plain;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [PREFIX, b64(iv), b64(cipher.getAuthTag()), b64(enc)].join(":");
}

/**
 * Decifra um valor lido do banco. Tolerante por desenho:
 *  · valor sem o prefixo "v1:" => dado legado em claro, devolvido como está;
 *  · com prefixo mas sem chave (ou chave trocada) => devolve null em vez de estourar,
 *    para que uma configuração errada não derrube listagens inteiras.
 */
export function decryptField(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;
  if (!stored.startsWith(`${PREFIX}:`)) return stored; // legado em claro
  if (!key) return null;
  const [, ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = createDecipheriv(ALGO, key, unb64(ivB64));
    decipher.setAuthTag(unb64(tagB64));
    return Buffer.concat([decipher.update(unb64(dataB64)), decipher.final()]).toString("utf8");
  } catch {
    return null; // tag inválida (adulteração) ou chave incorreta
  }
}
