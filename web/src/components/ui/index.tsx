"use client";

// Primitivas de superfície e texto, no vocabulário do nextjs-admin-dashboard
// (Card / ShowcaseSection) somado ao ChartTitle do visactor-next-template.
import { cloneElement, isValidElement, useId, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { GraphStatus, SubjectState } from "@/lib/api/types";

/**
 * Superfície base. **Sem hover por padrão**: erguer a sombra de um cartão que não é
 * clicável promete uma interação que não existe. Quem é clicável (os atalhos do admin,
 * por exemplo) pede `interactive`.
 */
export function Card({ className, interactive, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-xl border p-5 shadow-sm sm:p-6",
        interactive && "hover:border-ring/50 cursor-pointer transition-[border-color,box-shadow] hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

/** Cartão com cabeçalho + ação opcional à direita — o "bloco" de todas as páginas. */
export function Section({
  title, hint, action, children, className, bodyClassName,
}: {
  title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode;
  className?: string; bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="section-label">{title}</h3>
          {hint && <span className="text-subtle-foreground mt-1 text-xs">{hint}</span>}
        </div>
        {action}
      </div>
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="mt-1">{title}</h1>
      </div>
      {children}
    </header>
  );
}

const CHIP_TONES: Record<string, string> = {
  done: "text-done border-done/40 bg-done/10",
  avail: "text-avail border-avail/40 bg-avail/10",
  co: "text-co border-co/40 bg-co/10",
  lock: "text-lock border-lock/40 bg-lock/10",
  sim: "text-sim border-sim/40 bg-sim/10",
  cursando: "text-jenipapo border-jenipapo/40 bg-jenipapo/10",
  neutral: "text-muted-foreground bg-muted",
};

export function Chip({ tone = "neutral", children, className, title }: {
  tone?: keyof typeof CHIP_TONES | string; children: ReactNode; className?: string; title?: string;
}) {
  return (
    <span title={title} className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
      CHIP_TONES[tone] ?? CHIP_TONES.neutral, className,
    )}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

const STATUS_LABEL: Record<GraphStatus, string> = {
  done: "Concluída", avail: "Disponível", co: "Co-requisito", lock: "Bloqueada",
};

export function StatusChip({ status, state }: { status: GraphStatus; state?: SubjectState | null }) {
  if (state === "SIMULATED") return <Chip tone="sim">Simulada</Chip>;
  if (state === "ENROLLED") return <Chip tone="cursando">Cursando</Chip>;
  return <Chip tone={status}>{STATUS_LABEL[status]}</Chip>;
}

export function Badge({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn(
      "bg-muted text-muted-foreground inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[0.7rem]",
      className,
    )}>
      {children}
    </span>
  );
}

/** Barra de progresso simples (integralização, composições). */
export function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn("bg-muted h-2 overflow-hidden rounded-full", className)}>
      <div className="bg-primary h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-muted-foreground rounded-xl border border-dashed p-5 text-sm">{children}</div>;
}

/** Abas-pílula (controle segmentado) — usado nos filtros das listagens. */
export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { v: T; label: string }[]; label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="bg-muted inline-flex gap-1 rounded-lg border p-1">
      {options.map((o) => (
        <button key={o.v} type="button" role="tab" aria-selected={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === o.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Rótulo + controle.
 *
 * A associação é EXPLÍCITA (`htmlFor`/`id`), não pelo aninhamento: com `<label>` só
 * envolvendo um `<select>`, o nome acessível acaba virando o texto da opção selecionada
 * ("Concluído") em vez do rótulo ("Situação") — o leitor de tela anuncia o valor e não a
 * pergunta. O id é gerado aqui e injetado no filho, então os pontos de uso não mudam.
 */
export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  const child = isValidElement<{ id?: string }>(children) && !children.props.id
    ? cloneElement(children, { id })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id}
        className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.12em] uppercase">
        {label}
      </label>
      {child}
    </div>
  );
}

/** Estilo compartilhado por input/select/textarea (o `FormElements` do admin dashboard). */
export const inputCls =
  "border-input bg-background text-foreground rounded-lg border px-3 py-2 text-sm font-normal normal-case tracking-normal " +
  "shadow-sm transition-[border-color,box-shadow] outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 " +
  "placeholder:text-subtle-foreground";
