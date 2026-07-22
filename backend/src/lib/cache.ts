// Cache TTL em memória, genérico e observável. Substitui os caches ad-hoc espalhados pelo
// código (o do grafo de curso era o único; agora qualquer leitura quente pode reusar isto).
//
// Escopo consciente: é POR PROCESSO. Em várias réplicas cada uma tem o seu — por isso o TTL é
// curto e toda mutação invalida explicitamente. Para cache compartilhado entre réplicas o
// caminho é Redis (já usado no rate limit); esta classe mantém a mesma interface, o que torna
// essa troca local e barata.
export type CacheStats = { hits: number; misses: number; size: number; evictions: number };

export class TtlCache<V> {
  readonly #entries = new Map<string, { at: number; value: V }>();
  #hits = 0;
  #misses = 0;
  #evictions = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500, // teto: evita crescimento sem limite (memory leak)
  ) {}

  get(key: string): V | undefined {
    const hit = this.#entries.get(key);
    if (!hit) { this.#misses += 1; return undefined; }
    if (Date.now() - hit.at >= this.ttlMs) {
      this.#entries.delete(key);
      this.#misses += 1;
      return undefined;
    }
    this.#hits += 1;
    return hit.value;
  }

  set(key: string, value: V): void {
    // política simples de despejo: ao estourar o teto, remove a entrada mais antiga inserida
    if (!this.#entries.has(key) && this.#entries.size >= this.maxEntries) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) { this.#entries.delete(oldest.value); this.#evictions += 1; }
    }
    this.#entries.set(key, { at: Date.now(), value });
  }

  /** Lê do cache ou resolve e memoriza. `null`/`undefined` NÃO são memorizados (evita cachear "não encontrado"). */
  async wrap(key: string, resolve: () => Promise<V | null>): Promise<V | null> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await resolve();
    if (value != null) this.set(key, value);
    return value;
  }

  invalidate(key?: string): void {
    if (key === undefined) this.#entries.clear();
    else this.#entries.delete(key);
  }

  get stats(): CacheStats {
    return { hits: this.#hits, misses: this.#misses, size: this.#entries.size, evictions: this.#evictions };
  }
}
