import { describe, it, expect } from "vitest";
import { generateToken, hashToken, safeEqualHex } from "../../src/lib/crypto.js";

describe("crypto de tokens", () => {
  it("hashToken é determinístico e sha256 hex (64 chars)", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("generateToken produz valores únicos e url-safe", () => {
    const a = generateToken(), b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
  });

  it("safeEqualHex compara corretamente", () => {
    const h = hashToken("x");
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, hashToken("y"))).toBe(false);
    expect(safeEqualHex(h, "abc")).toBe(false); // tamanhos diferentes
  });
});
