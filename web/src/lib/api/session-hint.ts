"use client";

// O refresh vive num cookie httpOnly: o JavaScript não consegue perguntar se existe.
// Sem nenhuma pista, todo visitante anônimo dispara um POST /auth/refresh no boot só para
// receber 401 — uma requisição inútil e um erro vermelho no console de quem só quer ler a
// página pública.
//
// A pista é uma marca local (não é credencial, não dá acesso a nada): "esta pessoa já teve
// sessão neste navegador". Sem ela, o boot nem tenta renovar. Se a marca sumir mas o cookie
// existir, o custo é um login a mais — nunca uma sessão indevida.
const KEY = "painel:has-session";

export const markSession = () => {
  try { localStorage.setItem(KEY, "1"); } catch { /* modo privativo/sem storage */ }
};

export const clearSessionHint = () => {
  try { localStorage.removeItem(KEY); } catch { /* idem */ }
};

export const hadSession = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};
