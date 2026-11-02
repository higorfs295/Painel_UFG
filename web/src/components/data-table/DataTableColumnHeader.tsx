// DataTableColumnHeader do tremorlabs/template-dashboard (MIT). Agora é um <button>
// (era <div> com onClick): ordenar pela coluna funciona também pelo teclado.
import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react";
import type { Column } from "@tanstack/react-table";
import { cx } from "@/lib/utils";

export function DataTableColumnHeader<TData, TValue>({ column, title, className }: {
  column: Column<TData, TValue>; title: string; className?: string;
}) {
  if (!column.getCanSort()) return <div className={cx(className)}>{title}</div>;
  const sorted = column.getIsSorted();
  return (
    <button type="button" onClick={column.getToggleSortingHandler()}
      aria-label={`Ordenar por ${title}${sorted === "asc" ? " (crescente)" : sorted === "desc" ? " (decrescente)" : ""}`}
      className={cx("-mx-2 inline-flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 select-none hover:bg-gray-50 dark:hover:bg-gray-900", className)}>
      <span>{title}</span>
      <div className="-space-y-2">
        <RiArrowUpSLine className={cx("size-3.5 text-gray-900 dark:text-gray-50", sorted === "desc" ? "opacity-30" : "")} aria-hidden="true" />
        <RiArrowDownSLine className={cx("size-3.5 text-gray-900 dark:text-gray-50", sorted === "asc" ? "opacity-30" : "")} aria-hidden="true" />
      </div>
    </button>
  );
}
