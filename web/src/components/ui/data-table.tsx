// Tabela declarativa — a ideia do `components/Tables` do nextjs-admin-dashboard: as colunas
// são dados (cabeçalho + célula + alinhamento), e o componente cuida de cabeçalho, divisórias,
// rolagem horizontal e estado vazio. Uma definição só serve para renderizar E para exportar CSV.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
    return <div className="text-muted-foreground rounded-xl border border-dashed p-5 text-sm">{empty ?? "Nada por aqui."}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header}
                className={cn(
                  "text-subtle-foreground border-b px-3 pb-2 text-[0.65rem] font-semibold tracking-[0.14em] uppercase",
                  c.align === "right" ? "text-right" : "text-left",
                )}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keyOf(row, i)} className="hover:bg-muted/60 transition-colors">
              {columns.map((c) => (
                <td key={c.header}
                  className={cn("border-b px-3 py-2.5 text-sm",
                    c.align === "right" ? "text-right" : "text-left", c.className)}
                  style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
