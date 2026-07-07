// Cliente HTTP mínimo: JWT em memória + refresh via cookie httpOnly.
// Use com TanStack Query nas páginas (queries/mutations por módulo).
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3333"}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers },
  });
  if (res.status === 401) { /* TODO: tentar POST /auth/refresh uma vez e repetir */ }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
