// Kit compartilhado: cache TTL e cifra de campo.
import { describe, it, expect, vi, afterEach } from "vitest";
import { TtlCache } from "../../src/lib/cache.js";
import { encryptField, decryptField } from "../../src/lib/fieldCrypto.js";

afterEach(() => vi.useRealTimers());

describe("TtlCache", () => {
  it("serve do cache dentro do TTL e expira depois", () => {
    vi.useFakeTimers();
    const c = new TtlCache<number>(1000);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    expect(c.stats.hits).toBe(1);

    vi.advanceTimersByTime(1001);
    expect(c.get("a")).toBeUndefined();      // expirou
    expect(c.stats.misses).toBe(1);
    expect(c.stats.size).toBe(0);            // entrada vencida é removida na leitura
  });

  it("wrap resolve uma vez e memoriza; não memoriza null", async () => {
    const c = new TtlCache<string>(1000);
    let calls = 0;
    const resolve = async () => { calls += 1; return "v"; };
    expect(await c.wrap("k", resolve)).toBe("v");
    expect(await c.wrap("k", resolve)).toBe("v");
    expect(calls).toBe(1);                    // segunda leitura veio do cache

    const nulls = new TtlCache<string>(1000);
    let nullCalls = 0;
    const resolveNull = async () => { nullCalls += 1; return null; };
    await nulls.wrap("x", resolveNull);
    await nulls.wrap("x", resolveNull);
    expect(nullCalls).toBe(2);                // null nunca é memorizado
  });

  it("invalidate remove uma chave ou tudo; respeita o teto de entradas", () => {
    const c = new TtlCache<number>(1000, 2);
    c.set("a", 1); c.set("b", 2); c.set("c", 3); // estoura o teto -> despeja a mais antiga
    expect(c.get("a")).toBeUndefined();
    expect(c.stats.evictions).toBe(1);

    c.invalidate("b");
    expect(c.get("b")).toBeUndefined();
    c.set("d", 4);
    c.invalidate();
    expect(c.stats.size).toBe(0);
  });
});

describe("fieldCrypto (sem FIELD_ENCRYPTION_KEY no ambiente de teste)", () => {
  it("modo transparente: ida e volta preserva o valor", () => {
    const enc = encryptField("20240010000");
    expect(decryptField(enc)).toBe("20240010000");
  });

  it("nulo/vazio viram null", () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField("")).toBeNull();
    expect(decryptField(null)).toBeNull();
  });

  it("valor legado em claro é devolvido como está", () => {
    expect(decryptField("123456")).toBe("123456");
  });

  it("valor cifrado sem chave configurada não vaza conteúdo (devolve null)", () => {
    // formato v1 válido, mas este processo não tem chave => não decifra
    expect(decryptField("v1:aaaa:bbbb:cccc")).toBeNull();
  });
});
