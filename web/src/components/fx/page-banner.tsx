"use client";

// Faixa de topo das páginas (v12) — o vocabulário do tremorlabs/template-solar trazido para
// dentro do app: campo de pontos vivo, hachura diagonal e guia tracejada, sobre um degradê
// suave da cor de destaque. À esquerda, título e ações; à direita, o "herói" da página
// (anel, números). O <h1> continua sendo o título da página (acessibilidade e testes).
import { DotField } from "./dot-field";
import { cx } from "@/lib/utils";

export function PageBanner({
  eyebrow, icon: Icon, title, description, actions, aside, className, tone = "brand",
}: {
  eyebrow?: string;
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  /** "brand" (padrão) ou uma cor de status para páginas temáticas */
  tone?: "brand" | "emerald" | "violet" | "blue" | "amber";
}) {
  const T = {
    brand: { wash: "from-brand-50 via-white to-white dark:from-brand-500/10 dark:via-gray-950 dark:to-gray-950", dots: "text-brand-500/70 dark:text-brand-400/60", chip: "bg-brand-600 text-white dark:bg-brand-500 dark:text-gray-950", hatch: "text-brand-500/15" },
    emerald: { wash: "from-emerald-50 via-white to-white dark:from-emerald-500/10 dark:via-gray-950 dark:to-gray-950", dots: "text-emerald-500/70 dark:text-emerald-400/60", chip: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-gray-950", hatch: "text-emerald-500/15" },
    violet: { wash: "from-violet-50 via-white to-white dark:from-violet-500/10 dark:via-gray-950 dark:to-gray-950", dots: "text-violet-500/70 dark:text-violet-400/60", chip: "bg-violet-600 text-white dark:bg-violet-500 dark:text-gray-950", hatch: "text-violet-500/15" },
    blue: { wash: "from-blue-50 via-white to-white dark:from-blue-500/10 dark:via-gray-950 dark:to-gray-950", dots: "text-blue-500/70 dark:text-blue-400/60", chip: "bg-blue-600 text-white dark:bg-blue-500 dark:text-gray-950", hatch: "text-blue-500/15" },
    amber: { wash: "from-amber-50 via-white to-white dark:from-amber-500/10 dark:via-gray-950 dark:to-gray-950", dots: "text-amber-500/70 dark:text-amber-400/60", chip: "bg-amber-600 text-white dark:bg-amber-500 dark:text-gray-950", hatch: "text-amber-500/15" },
  }[tone];
  return (
    <section className={cx(
      "relative isolate overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br shadow-xs dark:border-gray-800",
      T.wash, className,
    )}>
      {/* campo de pontos à direita, apagando para a esquerda */}
      <div aria-hidden="true" className={cx("pointer-events-none absolute inset-y-0 right-0 -z-10 w-2/3 [mask-image:radial-gradient(ellipse_at_right,black_10%,transparent_70%)]", T.dots)}>
        <DotField className="h-full w-full" />
      </div>
      {/* hachura na quina e guia tracejada na base: os grafismos do Solar */}
      <div aria-hidden="true" className={cx("hatch pointer-events-none absolute -top-6 -right-6 -z-10 h-28 w-28 rotate-12 rounded-2xl", T.hatch)} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-0 -z-10 border-b border-dashed border-gray-300/70 dark:border-gray-700/70" />

      <div className="flex flex-col gap-6 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-medium tracking-wide text-gray-600 uppercase dark:text-gray-400">
              {Icon && (
                <span aria-hidden="true" className={cx("grid size-6 place-items-center rounded-md shadow-xs", T.chip)}>
                  <Icon className="size-3.5" />
                </span>
              )}
              {eyebrow}
            </p>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-gray-50">{title}</h1>
          {description && <div className="mt-1.5 max-w-2xl text-sm text-gray-600 dark:text-gray-400">{description}</div>}
          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </section>
  );
}
