"use client";

// Primitivas usadas pelas páginas — agora desenhadas com o vocabulário da Tremor
// (tremorlabs/template-dashboard, MIT): cartão com borda fina e sombra mínima, títulos
// em text-sm semibold, badges retangulares com anel, barra de progresso de 1,5 px de
// altura, campos com o `inputStyles` do template. A API das versões anteriores foi
// mantida para as páginas antigas continuarem funcionando sem reescrita.
import { PageBanner } from "@/components/fx/page-banner";
import { cloneElement, isValidElement, useId, type ComponentType, type HTMLAttributes, type ReactNode, type SVGProps } from "react";
import { cx } from "@/lib/utils";
import { ProgressBar } from "@/components/tremor/ProgressBar";
import type { GraphStatus, SubjectState } from "@/lib/api/types";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/** Tremor Raw Card. Sem hover por padrão: só o que é clicável pede `interactive`. */
export function Card({ className, interactive, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        "relative w-full rounded-lg border p-6 text-left shadow-xs",
        "border-gray-200 bg-white dark:border-gray-900 dark:bg-[#090E1A]",
        interactive && "cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-900/60",
        className,
      )}
      {...props}
    />
  );
}

/** Cartão com título + ação à direita — o "bloco" das páginas. */
export function Section({
  title, hint, action, icon: _icon, children, className, bodyClassName,
}: {
  title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode;
  /** mantido por compatibilidade; o desenho da Tremor não usa ícone no título */
  icon?: IconType;
  className?: string; bodyClassName?: string;
}) {
  return (
    <Card className={cx("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 sm:text-sm dark:text-gray-50">{title}</h3>
          {hint && <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
        {action}
      </div>
      <div className={cx("mt-4 min-w-0 flex-1", bodyClassName)}>{children}</div>
    </Card>
  );
}

/**
 * Título da página. Desde a v12 é a faixa de topo (PageBanner): campo de pontos, hachura e o
 * selo de ícone na cor de destaque, com o <h1> e as ações da página.
 */
export function PageHead({ eyebrow, title, description, children, icon, aside, tone }: {
  eyebrow?: string; title: ReactNode; description?: ReactNode; children?: ReactNode;
  icon?: ComponentType<{ className?: string }>; aside?: ReactNode;
  tone?: "brand" | "emerald" | "violet" | "blue" | "amber";
}) {
  const label = eyebrow ? eyebrow.charAt(0).toUpperCase() + eyebrow.slice(1) : undefined;
  return <PageBanner eyebrow={label} icon={icon} title={title} description={description} actions={children} aside={aside} tone={tone} />;
}

/** KPI no estilo dos cartões do template: título em negrito, valor grande sem peso, nota. */
export function StatCard({ label, value, sub, className, children, badge }: {
  label: string; value: ReactNode; sub?: ReactNode; className?: string; children?: ReactNode;
  badge?: ReactNode;
  /** mantidos por compatibilidade */
  icon?: IconType; tone?: string;
}) {
  return (
    <Card className={cx("flex flex-col", className)}>
      <div className="flex items-center gap-2">
        <p className="font-bold text-gray-900 sm:text-sm dark:text-gray-50">{label}</p>
        {badge}
      </div>
      <p className="mt-2 text-2xl text-gray-900 tabular-nums dark:text-gray-50">{value}</p>
      {sub && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sub}</p>}
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}

// Badge da Tremor (rounded, ring-1, text-xs semibold) — tons pelo significado acadêmico
const TONES: Record<string, string> = {
  done: "bg-emerald-50 text-emerald-800 ring-emerald-600/30 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  avail: "bg-amber-50 text-amber-800 ring-amber-600/30 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/30",
  primary: "bg-brand-50 text-brand-800 ring-brand-500/30 dark:bg-brand-400/10 dark:text-brand-400 dark:ring-brand-400/30",
  co: "bg-sky-50 text-sky-800 ring-sky-600/30 dark:bg-sky-400/10 dark:text-sky-400 dark:ring-sky-400/20",
  cursando: "bg-blue-50 text-blue-800 ring-blue-600/30 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20",
  sim: "bg-violet-50 text-violet-800 ring-violet-600/30 dark:bg-violet-400/10 dark:text-violet-400 dark:ring-violet-400/20",
  lock: "bg-gray-50 text-gray-700 ring-gray-500/30 dark:bg-gray-400/10 dark:text-gray-300 dark:ring-gray-400/20",
  danger: "bg-red-50 text-red-800 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20",
  warning: "bg-yellow-50 text-yellow-800 ring-yellow-600/30 dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20",
  neutral: "bg-gray-50 text-gray-700 ring-gray-500/30 dark:bg-gray-400/10 dark:text-gray-300 dark:ring-gray-400/20",
};

export function Chip({ tone = "neutral", children, className, title }: {
  tone?: keyof typeof TONES | string; children: ReactNode; className?: string; title?: string;
}) {
  return (
    <span title={title} className={cx(
      "inline-flex items-center gap-x-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1",
      TONES[tone] ?? TONES.neutral, className,
    )}>
      {children}
    </span>
  );
}

const STATUS_LABEL: Record<GraphStatus, string> = {
  done: "Concluída", avail: "Disponível", co: "Co-requisito", lock: "Bloqueada",
};

const DOT: Record<string, string> = {
  done: "bg-emerald-600 dark:bg-emerald-400", avail: "bg-amber-500", co: "bg-sky-500",
  lock: "bg-gray-400", sim: "bg-violet-500", cursando: "bg-blue-600 dark:bg-blue-400",
};

/** Situação com ponto colorido (v12): as cores fixas de situação (lib/palette). */
export function StatusChip({ status, state }: { status: GraphStatus; state?: SubjectState | null }) {
  const tone = state === "SIMULATED" ? "sim" : state === "ENROLLED" ? "cursando" : status;
  const label = state === "SIMULATED" ? "Simulada" : state === "ENROLLED" ? "Cursando" : STATUS_LABEL[status];
  return (
    <Chip tone={tone}>
      <span className={cx("size-1.5 rounded-full", DOT[tone])} aria-hidden="true" />{label}
    </Chip>
  );
}

/** Código/slug: monoespaçado, discreto. */
export function Badge({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx(
      "inline-flex items-center rounded-sm bg-gray-50 px-1.5 py-0.5 font-mono text-xs text-gray-700 ring-1 ring-gray-200",
      "dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800",
      className,
    )}>
      {children}
    </span>
  );
}

/** ProgressBar da Tremor, na espessura usada nos cartões do template (h-1.5). */
export function Bar({ pct, className }: { pct: number; className?: string }) {
  return <ProgressBar value={Math.min(100, Math.max(0, pct))} className={cx("[&>*]:h-1.5", className)} />;
}

export function EmptyState({ children, icon: Icon }: { children: ReactNode; icon?: IconType }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-gray-500 dark:text-gray-400" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Abas "solid" da Tremor (Tabs) como controle segmentado — usado nos filtros. */
export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { v: T; label: string }[]; label: string;
}) {
  return (
    <div role="tablist" aria-label={label}
      className="inline-flex max-w-full overflow-x-auto rounded-md bg-gray-100 p-1 dark:bg-gray-900">
      {options.map((o) => (
        <button key={o.v} type="button" role="tab" aria-selected={value === o.v}
          onClick={() => onChange(o.v)}
          className={cx(
            "cursor-pointer rounded-sm px-3 py-1 text-sm font-medium whitespace-nowrap transition",
            "outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2",
            value === o.v
              ? "bg-white text-gray-900 shadow-xs ring-1 ring-black/5 dark:bg-gray-950 dark:text-gray-50 dark:ring-white/10"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Rótulo + controle, no layout do formulário da Tremor (Label text-sm medium, campo mt-2).
 *
 * A associação é EXPLÍCITA (`htmlFor`/`id`), não pelo aninhamento: com `<label>` só
 * envolvendo um `<select>`, o nome acessível vira o texto da opção selecionada
 * ("Concluído") em vez do rótulo ("Situação").
 */
export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  const child = isValidElement<{ id?: string }>(children) && !children.props.id
    ? cloneElement(children, { id })
    : children;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm leading-none font-medium text-gray-900 dark:text-gray-50">
        {label}
      </label>
      {child}
    </div>
  );
}

/** `inputStyles` do Tremor Raw Input (sem `w-full`/`appearance-none`, que quebrariam selects e linhas flex antigas). */
export const inputCls =
  "relative block rounded-md border px-2.5 py-2 text-sm shadow-xs outline-hidden transition " +
  "border-gray-300 dark:border-gray-800 text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-950 " +
  "placeholder:text-gray-500 dark:placeholder:text-gray-400 " +
  "disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:border-gray-700 dark:disabled:bg-gray-800 dark:disabled:text-gray-500 " +
  "focus:ring-2 focus:ring-brand-200 focus:border-brand-500 dark:focus:ring-brand-700/30 dark:focus:border-brand-700";

/** Select nativo com a mesma pele (o seletor do sistema, acessível e testável). */
export const selectCls = `${inputCls} w-full pr-8`;
