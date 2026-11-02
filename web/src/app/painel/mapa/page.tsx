"use client";

// Mapa curricular — a matriz em camadas de pré-requisito.
//
// Cada coluna é uma "profundidade": quantos pré-requisitos encadeados vêm antes da
// disciplina (coluna 0 = sem requisito). Selecionar um nó acende a cadeia inteira que ele
// exige (acento) e tudo o que ele libera adiante (azul); o resto esmaece. Os detalhes
// abrem na gaveta da disciplina, onde dá para marcar e anotar.
//
// Sem biblioteca de grafo: com ~120 nós, colunas + realce comunicam a estrutura sem o
// emaranhado de arestas cruzadas que um desenho força-dirigido produziria.
import { useMemo, useState } from "react";
import { useCourseDetail, useProgress } from "@/hooks/use-progress";
import { buildGraph, closure } from "@/lib/curriculum-graph";
import { Card, EmptyState, PageHead, Segmented, inputCls } from "@/components/ui";
import Button from "@/components/ui/button";
import { SubjectDrawer } from "@/components/subject-drawer";
import { cn } from "@/lib/utils";
import type { GraphStatus } from "@/lib/api/types";

const STATUS_DOT: Record<GraphStatus, string> = {
  done: "bg-done", avail: "bg-avail", co: "bg-co", lock: "bg-lock",
};
const LEGEND: { s: GraphStatus; label: string }[] = [
  { s: "done", label: "Concluída" }, { s: "avail", label: "Disponível" },
  { s: "co", label: "Co-requisito" }, { s: "lock", label: "Bloqueada" },
];

type Scope = "obrig" | "todas";

export default function MapaPage() {
  const { data: prog, isLoading } = useProgress();
  const { data: course } = useCourseDetail();
  const [selected, setSelected] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [scope, setScope] = useState<Scope>("obrig");
  const [q, setQ] = useState("");

  const graph = useMemo(() => (course ? buildGraph(course) : null), [course]);
  const statusBySeq = useMemo(() => new Map(prog?.subjects.map((s) => [s.seq, s]) ?? []), [prog]);

  const up = useMemo(() => (graph && selected != null ? closure(graph, selected, "up") : new Set<number>()), [graph, selected]);
  const down = useMemo(() => (graph && selected != null ? closure(graph, selected, "down") : new Set<number>()), [graph, selected]);

  const columns = useMemo(() => {
    if (!graph) return [];
    const cols: number[][] = Array.from({ length: graph.maxDepth + 1 }, () => []);
    for (const [seq, s] of graph.bySeq) {
      if (scope === "obrig" && s.groupOpt > 0) continue;
      cols[graph.depth.get(seq) ?? 0]!.push(seq);
    }
    // dentro da coluna: ordem da matriz (que costuma seguir o período sugerido)
    return cols.map((c) => c.sort((a, b) => a - b)).filter((c) => c.length);
  }, [graph, scope]);

  const needle = q.trim().toLowerCase();
  const matches = (seq: number) => {
    if (!needle) return true;
    const s = graph?.bySeq.get(seq);
    return !!s && (s.name.toLowerCase().includes(needle) || s.code.toLowerCase().includes(needle));
  };

  if (isLoading || !prog || !graph) {
    return (
      <div className="flex flex-col gap-5">
        <div className="skeleton h-16 w-72" />
        <div className="skeleton h-[480px]" />
      </div>
    );
  }

  const sel = selected != null ? graph.bySeq.get(selected) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="matriz curricular" title="Mapa curricular"
        description="Colunas por profundidade de pré-requisito. Clique numa disciplina para acender o que ela exige e o que ela libera; clique de novo para abrir os detalhes." />

      <Card className="flex flex-wrap items-center justify-between gap-3 !py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Localizar disciplina…"
            aria-label="Localizar disciplina no mapa" className={cn(inputCls, "min-w-[220px]")} />
          <Segmented label="Escopo do mapa" value={scope} onChange={setScope}
            options={[{ v: "obrig", label: "Obrigatórias" }, { v: "todas", label: "Com optativas" }]} />
        </div>
        <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {LEGEND.map((l) => (
            <li key={l.s} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", STATUS_DOT[l.s])} />{l.label}</li>
          ))}
        </ul>
      </Card>

      {sel && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-gray-900 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-gray-50">
          <span className="min-w-0 flex-1">
            <b>{sel.name}</b> exige <b className="num">{up.size}</b> disciplina(s) na cadeia e libera{" "}
            <b className="num">{down.size}</b> adiante.
          </span>
          <Button size="sm" variant="primary" onClick={() => setOpen(sel.seq)}>Abrir detalhes</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Limpar seleção</Button>
        </div>
      )}

      {columns.length === 0 ? (
        <EmptyState>A matriz deste curso ainda não tem disciplinas.</EmptyState>
      ) : (
        <Card className="!p-0">
          <div className="overflow-x-auto p-4" role="list" aria-label="Disciplinas por camada de pré-requisito">
            <div className="flex gap-3">
              {columns.map((col, ci) => (
                <div key={ci} role="listitem" className="flex w-[196px] shrink-0 flex-col gap-2">
                  <div className="sticky top-0 flex items-baseline justify-between px-1 pb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {ci === 0 ? "Sem requisito" : `Camada ${ci}`}
                    </span>
                    <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">{col.length}</span>
                  </div>
                  {col.map((seq) => {
                    const s = graph.bySeq.get(seq)!;
                    const p = statusBySeq.get(seq);
                    const isSel = selected === seq;
                    const inUp = up.has(seq), inDown = down.has(seq);
                    const dim = (selected != null && !isSel && !inUp && !inDown) || !matches(seq);
                    return (
                      <button key={seq} type="button"
                        onClick={() => (isSel ? setOpen(seq) : setSelected(seq))}
                        aria-pressed={isSel}
                        aria-label={`${s.name}${p ? ` — ${p.status}` : ""}`}
                        className={cn(
                          "group relative cursor-pointer rounded-md border border-gray-200 bg-white px-2.5 py-2 text-left shadow-xs transition-[opacity,box-shadow,border-color]",
                          "hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700",
                          isSel && "border-orange-500 ring-2 ring-orange-500/30 dark:border-orange-500",
                          inUp && "border-orange-300 bg-orange-50 dark:border-orange-500/50 dark:bg-orange-500/10",
                          inDown && "border-blue-300 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-500/10",
                          dim && "opacity-30",
                          p?.state === "SIMULATED" && "border-dashed",
                        )}>
                        <span className="flex items-center gap-1.5">
                          <span className={cn("size-1.5 shrink-0 rounded-full", p ? STATUS_DOT[p.status] : "bg-border")} />
                          <span className="truncate font-mono text-[0.65rem] text-gray-500 dark:text-gray-400">{s.code || `#${seq}`}</span>
                          <span className="ml-auto text-[0.65rem] text-gray-500 tabular-nums dark:text-gray-400">{s.hours} h</span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-[0.8rem] leading-snug font-medium text-gray-900 dark:text-gray-50">{s.name}</span>
                        {s.groupOpt > 0 && <span className="mt-0.5 block text-[0.68rem] text-violet-700 dark:text-violet-400">optativa · grupo {s.groupOpt}</span>}
                        {graph.milestones.get(seq)?.length ? (
                          <span className="mt-0.5 block text-[0.68rem] text-orange-700 dark:text-orange-400">exige {graph.milestones.get(seq)!.join(" + ")}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <SubjectDrawer seq={open} onClose={() => setOpen(null)} onNavigate={(s) => { setSelected(s); setOpen(s); }} />
    </div>
  );
}
