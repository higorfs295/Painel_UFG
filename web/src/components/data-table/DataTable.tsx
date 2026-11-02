"use client";

// DataTable do tremorlabs/template-dashboard (MIT, © 2025 Tremor Labs, Inc.), em TanStack
// Table: clique na linha seleciona, filete de acento na linha selecionada, cabeçalho
// ordenável, paginação de 20 em 20 e a barra de comandos em lote quando há seleção.
// Diferenças: textos em português, `toolbar`/`bulk` vêm de fora (o template fixava os
// filtros de exemplo) e cliques em controles da linha não alternam a seleção.
import * as React from "react";
import {
  type ColumnDef, type Row, type RowSelectionState, type Table as TableType, flexRender,
  getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/tremor/Table";
import { cx } from "@/lib/utils";
import { DataTablePagination } from "./DataTablePagination";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    className?: string;
    displayName?: string;
  }
}

export function DataTable<TData>({
  columns, data, getRowId, toolbar, bulk, pageSize = 20, empty = "Nenhum resultado.",
}: {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  getRowId: (row: TData) => string;
  toolbar?: React.ReactNode;
  bulk?: (args: { table: TableType<TData>; rows: Row<TData>[]; reset: () => void }) => React.ReactNode;
  pageSize?: number;
  empty?: React.ReactNode;
}) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { rowSelection },
    initialState: { pagination: { pageIndex: 0, pageSize } },
    enableRowSelection: true,
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // seleção de linhas que saíram do filtro não pode continuar valendo para o lote
  React.useEffect(() => {
    setRowSelection((sel) => {
      const ids = new Set(data.map(getRowId));
      const next = Object.fromEntries(Object.entries(sel).filter(([id]) => ids.has(id)));
      return Object.keys(next).length === Object.keys(sel).length ? sel : next;
    });
  }, [data, getRowId]);

  const selected = table.getSelectedRowModel().rows;

  return (
    <div className="space-y-3">
      {toolbar}
      <div className="relative overflow-hidden overflow-x-auto">
        <Table>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-y border-gray-200 dark:border-gray-800">
                {headerGroup.headers.map((header) => (
                  <TableHeaderCell key={header.id}
                    className={cx("py-1 text-sm whitespace-nowrap sm:text-xs", header.column.columnDef.meta?.className)}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHeaderCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}
                  onClick={(e) => {
                    // botões, links e campos dentro da linha têm ação própria
                    if ((e.target as HTMLElement).closest("button, a, input, select, [role=menuitem]")) return;
                    row.toggleSelected(!row.getIsSelected());
                  }}
                  aria-selected={row.getIsSelected()}
                  className="group select-none hover:bg-gray-50 dark:hover:bg-gray-900">
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell key={cell.id}
                      className={cx(
                        row.getIsSelected() ? "bg-gray-50 dark:bg-gray-900" : "",
                        "relative py-1 whitespace-nowrap text-gray-600 first:w-10 dark:text-gray-400",
                        cell.column.columnDef.meta?.className,
                      )}>
                      {index === 0 && row.getIsSelected() && (
                        <div className="absolute inset-y-0 left-0 w-0.5 bg-brand-600 dark:bg-brand-500" />
                      )}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">{empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {bulk?.({ table, rows: selected, reset: () => table.resetRowSelection() })}
      </div>
      <DataTablePagination table={table} pageSize={table.getState().pagination.pageSize} />
    </div>
  );
}
