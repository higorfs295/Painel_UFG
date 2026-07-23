"use client";

// Recomendações (RF-07): disponíveis agora, ordenadas pelo quanto cada uma destrava
// adiante — obrigatórias primeiro, depois o total transitivo.
import Link from "next/link";
import { useRecommendations } from "@/hooks/use-progress";
import { Card, Chip, EmptyState, PageHead } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ExportButton, csvColumnsFrom } from "@/components/ui/export-button";
import Button from "@/components/ui/button";
import type { Recommendation } from "@/lib/api/types";

export default function RecomendacoesPage() {
  const { data, isLoading } = useRecommendations(24);
  const recs = data ?? [];
  const top = recs.slice(0, 3);

  const columns: Column<Recommendation>[] = [
    { header: "Código", cell: (r) => <span className="text-muted-foreground font-mono text-xs">{r.code}</span>, value: (r) => r.code },
    { header: "Disciplina", cell: (r) => r.name, value: (r) => r.name },
    { header: "CH", cell: (r) => `${r.hours}h`, value: (r) => r.hours },
    { header: "Destrava (obrig.)", align: "right", value: (r) => `${r.tot} (${r.ob})`,
      cell: (r) => <span><b>{r.tot}</b> <span className="text-muted-foreground">({r.ob})</span></span> },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="skeleton h-16 w-72" />
        <div className="grid gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-44" />)}
        </div>
        <div className="skeleton h-72" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="planejamento" title="Recomendações">
        <ExportButton name="recomendacoes" rows={recs} columns={csvColumnsFrom(columns)} />
      </PageHead>
      <p className="text-muted-foreground max-w-3xl text-sm">
        Tudo aqui já está <b className="text-foreground">disponível</b> para matrícula: os pré-requisitos
        estão cumpridos. A ordem é pelo quanto cada disciplina libera adiante — priorizando as obrigatórias.
      </p>

      {recs.length === 0 ? (
        <EmptyState>
          Nenhuma disciplina disponível no momento. Marque o que já cursou em{" "}
          <Link href="/painel/disciplinas" className="text-primary hover:underline">Disciplinas</Link>.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            {top.map((r, i) => (
              <Card key={r.seq} className="flex flex-col">
                <span className="font-display text-primary text-3xl leading-none font-semibold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display mt-3 text-lg font-semibold tracking-tight">{r.name}</h3>
                <p className="text-subtle-foreground mt-1 font-mono text-xs">{r.code} · {r.hours}h</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Chip tone="avail">destrava {r.tot}</Chip>
                  {r.ob > 0 && <Chip tone="done">{r.ob} obrigatória(s)</Chip>}
                </div>
                <Link href="/painel/disciplinas" className="mt-auto pt-5">
                  <Button size="sm">Marcar como cursando</Button>
                </Link>
              </Card>
            ))}
          </div>

          <Card>
            <h3 className="section-label">Todas as disponíveis</h3>
            <DataTable rows={recs} columns={columns} keyOf={(r) => String(r.seq)} />
          </Card>
        </>
      )}
    </div>
  );
}
