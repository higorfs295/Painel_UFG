// Tabela declarativa (colunas como dado) desenhada com o Tremor Raw Table: cabeçalho em
// text-sm semibold, linhas com divisória fina e hover leve. Uma definição só serve para
// renderizar E para exportar CSV (ver export-button).
import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from "@/components/tremor/Table";
import { cx } from "@/lib/utils";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** valor plano para o CSV; sem isto a coluna não é exportada */
  value?: (row: T) => unknown;
  align?: "left" | "right";
  className?: string;
};

export function DataTable<T>({ rows, columns, keyOf, empty }: {
  rows: T[]; columns: Column<T>[]; keyOf: (row: T, i: number) => string; empty?: ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
        {empty ?? "Nada por aqui."}
      </div>
    );
  }
  return (
    <TableRoot>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableHeaderCell key={c.header} className={cx(c.align === "right" && "text-right")}>{c.header}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={keyOf(row, i)} className="hover:bg-gray-50 dark:hover:bg-gray-900/60">
              {columns.map((c) => (
                <TableCell key={c.header} className={cx(c.align === "right" && "text-right", c.className)}>
                  {c.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableRoot>
  );
}
