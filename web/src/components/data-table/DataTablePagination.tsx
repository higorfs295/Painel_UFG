// DataTablePagination do tremorlabs/template-dashboard (MIT), em português.
import {
  RiArrowLeftDoubleLine, RiArrowLeftSLine, RiArrowRightDoubleLine, RiArrowRightSLine,
} from "@remixicon/react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/tremor/Button";
import { cx } from "@/lib/utils";

export function DataTablePagination<TData>({ table, pageSize }: { table: Table<TData>; pageSize: number }) {
  const buttons = [
    { icon: RiArrowLeftDoubleLine, onClick: () => table.setPageIndex(0), disabled: !table.getCanPreviousPage(), srText: "Primeira página", mobileView: "hidden sm:block" },
    { icon: RiArrowLeftSLine, onClick: () => table.previousPage(), disabled: !table.getCanPreviousPage(), srText: "Página anterior", mobileView: "" },
    { icon: RiArrowRightSLine, onClick: () => table.nextPage(), disabled: !table.getCanNextPage(), srText: "Próxima página", mobileView: "" },
    { icon: RiArrowRightDoubleLine, onClick: () => table.setPageIndex(table.getPageCount() - 1), disabled: !table.getCanNextPage(), srText: "Última página", mobileView: "hidden sm:block" },
  ];
  const totalRows = table.getCoreRowModel().rows.length;
  const currentPage = table.getState().pagination.pageIndex;
  const firstRowIndex = totalRows ? currentPage * pageSize + 1 : 0;
  const lastRowIndex = Math.min(totalRows, firstRowIndex + pageSize - 1);
  const selected = table.getSelectedRowModel().rows.length;

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-500 tabular-nums dark:text-gray-400">
        {selected} de {totalRows} selecionada(s)
      </div>
      <div className="flex items-center gap-x-6 lg:gap-x-8">
        <p className="hidden text-sm text-gray-500 tabular-nums sm:block dark:text-gray-400">
          Mostrando{" "}
          <span className="font-medium text-gray-900 dark:text-gray-50">{firstRowIndex}–{lastRowIndex}</span>{" "}
          de <span className="font-medium text-gray-900 dark:text-gray-50">{totalRows}</span>
        </p>
        <div className="flex items-center gap-x-1.5">
          {buttons.map((b) => (
            <Button key={b.srText} variant="secondary" className={cx(b.mobileView, "p-1.5")}
              onClick={() => { b.onClick(); table.resetRowSelection(); }} disabled={b.disabled}>
              <span className="sr-only">{b.srText}</span>
              <b.icon className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
