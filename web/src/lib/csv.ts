// Exportação para CSV — o formato que abre no Excel/Sheets sem intermediários.
//
// Duas armadilhas resolvidas aqui:
//  1. separador — o Excel em pt-BR espera ";" e ignora "," (por isso a linha "sep=;" no topo);
//  2. BOM UTF-8 — sem ele, "Álgebra" vira "Ãlgebra" ao abrir no Excel do Windows.

/** Escapa um valor: aspas duplicadas e o campo entre aspas quando há separador/quebra. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type Column<T> = { header: string; value: (row: T) => unknown };

export function toCSV<T>(rows: T[], columns: Column<T>[]): string {
  const head = columns.map((c) => cell(c.header)).join(";");
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(";"));
  return ["sep=;", head, ...body].join("\r\n");
}

/** Dispara o download no navegador. `name` sem extensão — a data entra no nome do arquivo. */
export function downloadCSV<T>(name: string, rows: T[], columns: Column<T>[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob(["﻿" + toCSV(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Número no formato pt-BR (vírgula decimal) — Excel brasileiro não entende "8.5". */
export const ptNum = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined ? "" : n.toFixed(digits).replace(".", ",");
