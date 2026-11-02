"use client";

// Recomendações (RF-07): disponíveis agora, ordenadas pelo quanto cada uma destrava
// adiante — obrigatórias primeiro, depois o total transitivo.
import { RiSparkling2Line } from "@remixicon/react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useCourseDetail, useRecommendations, useSetSubject } from "@/hooks/use-progress";
import { Card, Chip, EmptyState, PageHead } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ExportButton, csvColumnsFrom } from "@/components/ui/export-button";
import Button from "@/components/ui/button";
import type { Recommendation } from "@/lib/api/types";

export default function RecomendacoesPage() {
  const { data, isLoading } = useRecommendations(24);
  const { data: course } = useCourseDetail();
  const setSubject = useSetSubject();
  const recs = data ?? [];
  const top = recs.slice(0, 3);
  const idBySeq = new Map(course?.subjects.map((s) => [s.seq, s.id]) ?? []);

  // marca de verdade (antes o botão só levava para Disciplinas)
  function enroll(r: Recommendation) {
    const id = idBySeq.get(r.seq);
    if (!id) return;
    setSubject.mutate({ subjectId: id, state: "ENROLLED" }, {
      onSuccess: () => toast.success(`${r.name} marcada como cursando.`),
      onError: () => toast.error("Não foi possível marcar."),
    });
  }

  const columns: Column<Recommendation>[] = [
    { header: "Código", cell: (r) => <span className="font-mono text-xs">{r.code}</span>, value: (r) => r.code },
    { header: "Disciplina", cell: (r) => <span className="font-medium text-gray-900 dark:text-gray-50">{r.name}</span>, value: (r) => r.name },
    { header: "CH", align: "right", cell: (r) => <span className="tabular-nums">{r.hours} h</span>, value: (r) => r.hours },
    { header: "Destrava (obrig.)", align: "right", value: (r) => `${r.tot} (${r.ob})`,
      cell: (r) => <span className="tabular-nums"><b className="text-gray-900 dark:text-gray-50">{r.tot}</b> ({r.ob})</span> },
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
      <PageHead eyebrow="planejamento" title="Recomendações" icon={RiSparkling2Line} tone="emerald">
        <ExportButton name="recomendacoes" rows={recs} columns={csvColumnsFrom(columns)} />
      </PageHead>
      <p className="-mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
        Tudo aqui já está <b className="text-gray-900 dark:text-gray-50">disponível</b> para matrícula: os pré-requisitos
        estão cumpridos. A ordem é pelo quanto cada disciplina libera adiante — priorizando as obrigatórias.
      </p>

      {recs.length === 0 ? (
        <EmptyState>
          Nenhuma disciplina disponível no momento. Marque o que já cursou em{" "}
          <Link href="/painel/disciplinas" className="text-brand-700 hover:underline dark:text-brand-400">Disciplinas</Link>.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            {top.map((r, i) => (
              <Card key={r.seq} className="flex flex-col">
                <p className="text-sm text-gray-500 dark:text-gray-400">{i + 1}ª recomendação</p>
                <h3 className="mt-1 font-semibold text-gray-900 dark:text-gray-50">{r.name}</h3>
                <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">{r.code} · {r.hours} h</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Chip tone="avail">destrava {r.tot}</Chip>
                  {r.ob > 0 && <Chip tone="done">{r.ob} obrigatória(s)</Chip>}
                </div>
                <div className="mt-auto pt-5">
                  <Button size="sm" disabled={!idBySeq.get(r.seq) || setSubject.isPending} onClick={() => enroll(r)}>
                    Marcar como cursando
                  </Button>
                </div>
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
