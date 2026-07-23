"use client";

// Histórico (RF-22/23): média global ponderada pela CH, ritmo, desempenho por período e
// o histórico escolar completo — com filtro por período que também vale para o CSV.
import { useMemo, useState } from "react";
import { useAchievements, useHistory } from "@/hooks/use-progress";
import { AreaSpark, BarList, ChartTitle, MetricCard } from "@/components/charts";
import { Card, Chip, EmptyState, Field, PageHead, Section, inputCls } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ExportButton, csvColumnsFrom } from "@/components/ui/export-button";
import { IconChart, IconClock, IconStar, IconTarget } from "@/components/ui/icons";
import { cn, dec, num } from "@/lib/utils";
import { ptNum } from "@/lib/csv";
import type { HistoryRecord } from "@/lib/api/types";

export default function HistoricoPage() {
  const { data, isLoading } = useHistory();
  const { data: ach } = useAchievements();
  const [term, setTerm] = useState("");

  const records = useMemo(
    () => (data?.records ?? []).filter((r) => !term || r.term === term),
    [data, term]);

  const columns: Column<HistoryRecord>[] = [
    { header: "Período", cell: (r) => <span className="text-muted-foreground">{r.term ?? "—"}</span>, value: (r) => r.term ?? "" },
    { header: "Código", cell: (r) => <span className="text-muted-foreground font-mono text-xs">{r.code}</span>, value: (r) => r.code },
    { header: "Disciplina", cell: (r) => r.name, value: (r) => r.name },
    { header: "CH", cell: (r) => `${r.hours}h`, value: (r) => r.hours },
    { header: "Nota", cell: (r) => (r.grade != null ? <b>{dec(r.grade, 1)}</b> : "—"), value: (r) => ptNum(r.grade) },
    { header: "Faltas", cell: (r) => <span className="text-muted-foreground">{r.absences ?? "—"}</span>, value: (r) => r.absences ?? "" },
    {
      header: "Situação",
      cell: (r) => <Chip tone={r.state === "APPROVED" ? "done" : "cursando"}>{r.state === "APPROVED" ? "Aprovada" : "Cursando"}</Chip>,
      value: (r) => (r.state === "APPROVED" ? "Aprovada" : "Cursando"),
    },
  ];

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-5">
        <div className="skeleton h-16 w-72" />
        <div className="grid gap-5 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-32" />)}</div>
        <div className="skeleton h-72" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="desempenho" title="Histórico acadêmico" />

      <div className="grid gap-5 sm:grid-cols-3">
        <Card>
          <ChartTitle icon={IconStar} title="Média global" />
          <p className="font-display mt-4 text-4xl font-semibold tracking-tight">{dec(data.mga)}</p>
          <p className="text-subtle-foreground mt-1 text-xs">ponderada pela carga horária (MGA)</p>
        </Card>
        <Card>
          <ChartTitle icon={IconClock} title="Ritmo por período" />
          <p className="font-display mt-4 text-4xl font-semibold tracking-tight">
            {data.pace.avgHoursPerTerm != null ? `${num(data.pace.avgHoursPerTerm)}h` : "—"}
          </p>
          <p className="text-subtle-foreground mt-1 text-xs">média dos últimos períodos</p>
        </Card>
        <Card>
          <ChartTitle icon={IconTarget} title="Períodos restantes" />
          <p className="font-display mt-4 text-4xl font-semibold tracking-tight">{data.pace.estTermsLeft ?? "—"}</p>
          <p className="text-subtle-foreground mt-1 text-xs">faltam {num(data.totals.remaining)}h</p>
        </Card>
      </div>

      {data.terms.length > 0 && (
        <Card>
          <ChartTitle icon={IconChart} title="Desempenho por período" />
          <div className="mt-5 flex flex-wrap gap-8">
            <div className="min-w-[260px] flex-1">
              <AreaSpark points={data.terms.map((t) => ({ x: t.term, y: t.hours }))} />
              <div className="text-subtle-foreground mt-1 flex justify-between text-[0.7rem]">
                <span>{data.terms[0]?.term}</span>
                <span>{data.terms[data.terms.length - 1]?.term}</span>
              </div>
            </div>
            <div className="min-w-[260px] flex-1">
              <BarList unit="h" data={data.terms.map((t) => ({
                label: t.term,
                value: t.hours,
                hint: `${t.count} disciplina(s)${t.avg != null ? ` · média ${dec(t.avg)}` : ""}`,
              }))} />
            </div>
          </div>
          {data.noTerm.count > 0 && (
            <p className="text-muted-foreground mt-4 text-sm">
              + {data.noTerm.count} disciplina(s) sem período informado ({num(data.noTerm.hours)}h).
            </p>
          )}
        </Card>
      )}

      {ach && (
        <Section title="Conquistas" hint={`${ach.earned} de ${ach.total}`}>
          <ul className="flex flex-wrap gap-2">
            {ach.achievements.map((a) => (
              <li key={a.key} title={a.desc}
                className={cn(
                  "bg-card inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                  a.earned ? "border-done/50 text-done bg-done/10" : "text-muted-foreground opacity-55",
                )}>
                <span aria-hidden="true">{a.icon}</span> {a.label}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="section-label !mb-0">Histórico escolar</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Field label="Período" className="flex-row items-center gap-2">
              <select value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Filtrar por período"
                className={cn(inputCls, "py-1 text-xs")}>
                <option value="">todos</option>
                {data.terms.map((t) => <option key={t.term} value={t.term}>{t.term}</option>)}
              </select>
            </Field>
            <ExportButton name="historico" rows={records} columns={csvColumnsFrom(columns)} />
          </div>
        </div>
        <DataTable rows={records} columns={columns} keyOf={(r) => String(r.seq)}
          empty={<EmptyState>{term ? `Nada registrado em ${term}.` : "Nada registrado ainda."}</EmptyState>} />
      </Card>
    </div>
  );
}
