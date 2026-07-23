"use client";

// Exportação CSV das linhas VISÍVEIS — filtro na tela é filtro no arquivo.
import Button from "./button";
import { downloadCSV, type Column as CsvColumn } from "@/lib/csv";
import { IconDownload } from "./icons";
import type { Column } from "./data-table";

/** Aproveita a definição da tabela: coluna com `value` vira coluna do CSV. */
export function csvColumnsFrom<T>(columns: Column<T>[]): CsvColumn<T>[] {
  return columns
    .filter((c): c is Column<T> & { value: (row: T) => unknown } => typeof c.value === "function")
    .map((c) => ({ header: c.header, value: c.value }));
}

export function ExportButton<T>({ name, rows, columns, label = "Exportar CSV" }: {
  name: string; rows: T[]; columns: CsvColumn<T>[]; label?: string;
}) {
  return (
    <Button size="sm" variant="ghost" disabled={rows.length === 0}
      title={rows.length === 0 ? "Nada para exportar" : `Exportar ${rows.length} linha(s)`}
      onClick={() => downloadCSV(name, rows, columns)}>
      <IconDownload /> {label}
    </Button>
  );
}
