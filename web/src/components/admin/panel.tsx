"use client";

// Painel com título — o "cartão" das telas de administração (v12). Mesma superfície do Card da
// Tremor, com um selo de ícone opcional na cor da seção e uma ação à direita.
import { cx } from "@/lib/utils";
import { tone as toneOf } from "@/lib/palette";

export function Panel({
  title, description, icon: Icon, tone = "brand", action, children, className, bodyClassName, id,
}: {
  title: React.ReactNode; description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>; tone?: string;
  action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; id?: string;
}) {
  const t = toneOf(tone);
  return (
    <section aria-labelledby={id} className={cx(
      "flex flex-col rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-950",
      className,
    )}>
      <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-900">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span aria-hidden="true" className={cx("grid size-8 shrink-0 place-items-center rounded-md ring-1 ring-inset", t.soft)}>
              <Icon className="size-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={id} className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cx("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Rótulo-pílula com ponto colorido (situação, público, papel). */
export function Pill({ tone = "gray", children, className }: { tone?: string; children: React.ReactNode; className?: string }) {
  const t = toneOf(tone);
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", t.soft, className)}>
      <span className={cx("size-1.5 rounded-full", t.dot)} aria-hidden="true" />
      {children}
    </span>
  );
}
