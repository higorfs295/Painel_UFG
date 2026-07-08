// Cliente HTTP mínimo: JWT de acesso em memória + refresh via cookie httpOnly.
// Em 401, tenta POST /auth/refresh uma única vez e repete a requisição original.
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

function buildInit(init: RequestInit): RequestInit {
  return {
    credentials: "include",
    ...init,
    headers: {
      // Content-Type só quando há corpo: DELETE/POST sem body com "application/json"
      // fazem o Fastify rejeitar com 400 (JSON vazio não é JSON válido).
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  };
}

// Evita várias chamadas simultâneas de refresh: compartilham a mesma promise.
let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
      if (!res.ok) { setAccessToken(null); return false; }
      const { accessToken: next } = await res.json();
      setAccessToken(next);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await fetch(`${BASE}${path}`, buildInit(init));

  if (res.status === 401 && !path.startsWith("/auth/")) {
    const ok = await tryRefresh();
    if (ok) res = await fetch(`${BASE}${path}`, buildInit(init)); // repete uma vez com o novo token
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
