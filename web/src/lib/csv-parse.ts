// Leitura de CSV colado ou enviado (v12: importação de usuários em lote). Aceita vírgula ou
// ponto e vírgula (o Excel em português exporta com ";"), campos entre aspas e cabeçalho
// opcional. Sem dependência: o formato esperado é pequeno e conhecido.

/** Divide o texto em linhas de campos, respeitando aspas ("a;b" é um campo só). */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let field = "", row: string[] = [], quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field.trim()); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field.trim()); field = "";
      if (row.some((f) => f)) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field.trim());
  if (row.some((f) => f)) rows.push(row);
  return rows;
}

export type UserRow = { name: string; email: string; courseSlug?: string; role?: "ADMIN" | "USER" };
export type ParsedUserRow = UserRow & { line: number; error?: string };

const NAME = ["nome", "name", "aluno", "nome completo"];
const EMAIL = ["email", "e-mail", "mail"];
const COURSE = ["curso", "course", "slug", "matriz"];
const ROLE = ["papel", "role", "perfil", "tipo"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Converte as linhas em usuários. Sem cabeçalho, a ordem é: nome, e-mail, curso, papel. */
export function rowsToUsers(rows: string[][]): ParsedUserRow[] {
  if (!rows.length) return [];
  const head = rows[0]!.map((h) => h.toLowerCase());
  const hasHeader = head.some((h) => EMAIL.includes(h));
  const idx = (names: string[], fallback: number) => {
    if (!hasHeader) return fallback;
    const i = head.findIndex((h) => names.includes(h));
    return i;
  };
  const iName = idx(NAME, 0), iEmail = idx(EMAIL, 1), iCourse = idx(COURSE, 2), iRole = idx(ROLE, 3);
  const body = hasHeader ? rows.slice(1) : rows;
  const seen = new Set<string>();
  return body.map((r, k) => {
    const line = k + (hasHeader ? 2 : 1);
    const name = (iName >= 0 ? r[iName] : "") ?? "";
    const email = ((iEmail >= 0 ? r[iEmail] : "") ?? "").trim();
    const course = iCourse >= 0 ? (r[iCourse] ?? "").trim() : "";
    const roleRaw = iRole >= 0 ? (r[iRole] ?? "").trim().toLowerCase() : "";
    const role = roleRaw.startsWith("adm") ? "ADMIN" as const : "USER" as const;
    let error: string | undefined;
    if (name.trim().length < 2) error = "nome vazio ou curto";
    else if (!EMAIL_RE.test(email)) error = "e-mail inválido";
    else if (seen.has(email.toLowerCase())) error = "e-mail repetido na planilha";
    seen.add(email.toLowerCase());
    return { line, name: name.trim(), email, role, ...(course ? { courseSlug: course } : {}), ...(error ? { error } : {}) };
  });
}
