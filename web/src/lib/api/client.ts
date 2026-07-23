"use client";

// Cliente HTTP do Painel — mesmo contrato do backend Fastify: access token JWT em
// memória + refresh opaco em cookie httpOnly (path=/auth).
//
// Por que tudo no cliente, e não em Server Components: o refresh vive num cookie
// httpOnly emitido por OUTRA origem (a API em :3333). Um Server Component do Next não
// recebe esse cookie, então a sessão seria impossível de renovar no servidor. O padrão
// aqui é o mesmo do template visactor (dashboard client-side sobre uma API externa):
// Server Components montam a casca estática, e os dados vêm por TanStack Query.
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

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

// Evita várias renovações simultâneas: todas compartilham a mesma promise.
let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
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

/** Faz a requisição; em 401 tenta renovar UMA vez e repete. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await fetch(`${API_URL}${path}`, buildInit(init));

  if (res.status === 401 && !path.startsWith("/auth/")) {
    const ok = await tryRefresh();
    if (ok) res = await fetch(`${API_URL}${path}`, buildInit(init));
  }

  if (!res.ok) {
    let body: unknown;
    let message = `HTTP ${res.status}`;
    try {
      body = await res.json();
      const err = (body as { error?: string })?.error;
      if (err) message = err;
    } catch { /* resposta sem corpo JSON */ }
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
