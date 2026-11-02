"use client";

// Histórico (RF-22/23): média global ponderada pela CH, ritmo, desempenho por período e
// o histórico escolar completo — com filtro por período que também vale para o CSV.
// Desenho: seções do tremorlabs/template-dashboard (título, métricas lado a lado sem
// caixa, LineChart da Tremor, tabela com divisórias finas).
import { useMemo, useState } from "react";
import { useAchievements, useHistory } from "@/hooks/use-progress";
import { BarList } from "@/components/charts";
import { Badge } from "@/components/tremor/Badge";
import { Divider } from "@/components/tremor/Divider";
import { LineChart } from "@/components/tremor/LineChart";
import { Chip, selectCls } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ExportButton, csvColumnsFrom } from "@/components/ui/export-button";
import { cx, dec, num } from "@/lib/utils";
import { ptNum } from "@/lib/csv";
import type { HistoryRecord } from "@/lib/api/types";

function Kpi({ title, value, desc }: { title: string; value: string; desc: string }) {
  return (
    <div>
      <p className="font-bold text-gray-900 sm:text-sm dark:text-gray-50">{title}</p>
      <p className="mt-2 text-xl text-gray-900 tabular-nums dark:text-gray-50">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{desc}</p>
    </div>
  );
}

export default function HistoricoPage() {
  const { data, isLoading } = useHistory();
  const { data: ach } = useAchievements();
  const [term, setTerm] = useState("");

  const records = useMemo(() => (data?.records ?? []).filter((r) => !term || r.term === term), [data, term]);

  const columns: Column<HistoryRecord>[] = [
    { header: "Período", cell: (r) => r.term ?? "—", value: (r) => r.term ?? "" },
    { header: "Código", cell: (r) => <span className="font-mono text-xs">{r.code}</span>, value: (r) => r.code },
    { header: "Disciplina", cell: (r) => <span className="font-medium text-gray-900 dark:text-gray-50">{r.name}</span>, value: (r) => r.name },
    { header: "CH", align: "right", cell: (r) => <span className="tabular-nums">{r.hours} h</span>, value: (r) => r.hours },
    { header: "Nota", align: "right", cell: (r) => <span className="tabular-nums">{r.grade != null ? dec(r.grade, 1) : "—"}</span>, value: (r) => ptNum(r.grade) },
    { header: "Faltas", align: "right", cell: (r) => <span className="tabular-nums">{r.absences ?? "—"}</span>, value: (r) => r.absences ?? "" },
    {
      header: "Situação",
      cell: (r) => <Chip tone={r.state === "APPROVED" ? "done" : "cursando"}>{r.state === "APPROVED" ? "Aprovada" : "Cursando"}</Chip>,
      value: (r) => (r.state === "APPROVED" ? "Aprovada" : "Cursando"),
    },
  ];

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-8">
        <div className="skeleton h-7 w-64" />
        <div className="grid gap-14 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}</div>
        <div className="skeleton h-72" />
      </div>
    );
  }

  return (
    <>
      <section aria-labelledby="historico">
        <h1 id="historico">Histórico acadêmico</h1>
        <dl className="mt-4 grid grid-cols-1 gap-14 sm:mt-8 sm:grid-cols-3 lg:mt-10">
          <Kpi title="Média global" value={dec(data.mga)} desc="ponderada pela carga horária (MGA)" />
          <Kpi title="Ritmo por período" value={data.pace.avgHoursPerTerm != null ? `${num(data.pace.avgHoursPerTerm)} h` : "—"} desc="média dos períodos registrados" />
          <Kpi title="Períodos restantes" value={data.pace.estTermsLeft != null ? String(data.pace.estTermsLeft) : "—"} desc={`faltam ${num(data.totals.remaining)} h para integralizar`} />
        </dl>
      </section>

      {data.terms.length > 0 && (
        <section aria-labelledby="desempenho" className="mt-16">
          <h2 id="desempenho" className="text-lg font-semibold sm:text-xl">Desempenho por período</h2>
          <Divider className="mt-4 mb-8" />
          <div className="grid grid-cols-1 gap-14 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <p className="font-bold text-gray-900 sm:text-sm dark:text-gray-50">Horas aprovadas</p>
              <LineChart className="mt-6 h-64" data={data.terms.map((t) => ({ periodo: t.term, Horas: t.hours }))}
                index="periodo" categories={["Horas"]} colors={["orange"]} showLegend={false}
                valueFormatter={(v) => `${num(v)} h`} yAxisWidth={52} />
            </div>
            <div className="xl:col-span-2">
              <p className="font-bold text-gray-900 sm:text-sm dark:text-gray-50">Por período</p>
              <div className="mt-4">
                <BarList unit=" h" data={data.terms.map((t) => ({
                  label: t.term, value: t.hours,
                  hint: `${t.count} disc.${t.avg != null ? ` · média ${dec(t.avg)}` : ""}`,
                }))} />
              </div>
              {data.noTerm.count > 0 && (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  + {data.noTerm.count} disciplina(s) sem período informado ({num(data.noTerm.hours)} h).
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {ach && (
        <section aria-labelledby="conquistas" className="mt-16">
          <div className="flex items-center gap-2">
            <h2 id="conquistas" className="text-lg font-semibold sm:text-xl">Conquistas</h2>
            <Badge variant="neutral">{ach.earned} de {ach.total}</Badge>
          </div>
          <Divider className="mt-4 mb-2" />
          <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-800">
            {ach.achievements.map((a) => (
              <li key={a.key} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className={cx("text-sm font-medium", a.earned ? "text-gray-900 dark:text-gray-50" : "text-gray-500 dark:text-gray-400")}>{a.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{a.desc}</p>
                </div>
                <Badge variant={a.earned ? "success" : "neutral"}>{a.earned ? "alcançado" : "pendente"}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="escolar" className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="escolar" className="text-lg font-semibold sm:text-xl">Histórico escolar</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Filtrar por período"
              className={cx(selectCls, "w-auto py-1.5")}>
              <option value="">Todos os períodos</option>
              {data.terms.map((t) => <option key={t.term} value={t.term}>{t.term}</option>)}
            </select>
            <ExportButton name="historico" rows={records} columns={csvColumnsFrom(columns)} />
          </div>
        </div>
        <div className="mt-6">
          <DataTable rows={records} columns={columns} keyOf={(r) => String(r.seq)}
            empty={term ? `Nada registrado em ${term}.` : "Nada registrado ainda."} />
        </div>
      </section>
    </>
  );
}
