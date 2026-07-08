// Geração e hash de tokens opacos (convite e refresh). RNF-01: guardamos só o hash;
// o valor puro só existe no link/cookie enviado ao usuário.
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

// token puro seguro para URL (base64url, ~256 bits de entropia)
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// comparação em tempo constante entre dois hashes hex (evita timing side-channel)
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
