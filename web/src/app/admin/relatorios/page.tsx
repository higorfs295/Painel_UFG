"use client";

// Admin · Relatórios (v12): retrato ACADÊMICO AGREGADO de um curso — distribuição da
// integralização, composições, marcos, coortes e a demanda por disciplina (quem está apto,
// quem está cursando, onde a turma trava). Nada individual: o servidor só manda contagens e
// médias, e esconde o relatório inteiro de cursos com menos de 5 alunos. Notas não entram.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  RiBarChartBoxLine, RiDownloadLine, RiEyeOffLine, RiFireLine, RiFlagLine, RiGroupLine, RiLockLine,
  RiPercentLine, RiPlayCircleLine, RiShieldCheckLine, RiStackLine, RiUserStarLine,
} from "@remixicon/react";
import { admin } from "@/lib/api/endpoints";
import { downloadCSV } from "@/lib/csv";
import { compositionTone, tone } from "@/lib/palette";
import { PageBanner } from "@/components/fx/page-banner";
import { StatTile, EmptyArt } from "@/components/fx/art";
import { ProgressRing } from "@/components/fx/progress-ring";
import { Panel, Pill } from "@/components/admin/panel";
import { BarChart } from "@/components/tremor/BarChart";
import { Button } from "@/components/tremor/Button";
import { Label } from "@/components/tremor/Label";
import { selectCls } from "@/components/ui";
import { cx } from "@/lib/utils";
import type { CourseReport, ReportSubject } from "@/lib/api/types";

type FullReport = Extract<CourseReport, { suppressed: false }>;

export default function AdminRelatoriosPage() {
  return <Suspense fallback={<div className="skeleton h-96" />}><ReportsInner /></Suspense>;
}

/** Lista ranqueada com barra proporcional (cor por lista). */
function Ranking({ items, value, max, toneName, unit, empty }: {
  items: ReportSubject[]; value: (s: ReportSubject) => number; max: number; toneName: string; unit: (n: number, s: ReportSubject) => string; empty: string;
}) {
  if (!items.length) return <p className="text-sm text-gray-500 dark:text-gray-400">{empty}</p>;
  const t = tone(toneName);
  return (
    <ol className="stagger flex flex-col gap-2.5">
      {items.map((s, i) => (
        <li key={s.seq}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-gray-900 dark:text-gray-50" title={s.name}>
              <span className="mr-1.5 text-xs tabular-nums text-gray-400">{i + 1}.</span>{s.name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-gray-600 dark:text-gray-400">{unit(value(s), s)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
            <div className={cx("bar-grow h-full rounded-full", t.dot)} style={{ width: `${max ? (value(s) / max) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function ReportsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const analytics = useQuery({ queryKey: ["admin-analytics"], queryFn: admin.analytics });
  const list = analytics.data?.courses ?? [];
  const [slug, setSlug] = useState(params.get("curso") ?? "");
  useEffect(() => { if (!slug && list.length) setSlug([...list].sort((a, b) => b.enrollments - a.enrollments)[0]!.slug); }, [list, slug]);

  const report = useQuery({ queryKey: ["report", slug], queryFn: () => admin.courseReport(slug), enabled: !!slug });
  const r = report.data;
  const ok: FullReport | null = r && r.suppressed === false ? r : null;

  const rank = useMemo(() => {
    if (!ok) return null;
    const top = (f: (s: ReportSubject) => number) => [...ok.subjects].filter((s) => f(s) > 0).sort((a, b) => f(b) - f(a)).slice(0, 8);
    const block = (s: ReportSubject) => s.pending * s.unlocks;
    return { apt: top((s) => s.apt), enrolled: top((s) => s.enrolled), block: top(block), blockFn: block };
  }, [ok]);

  return (
    <div className="flex flex-col gap-6">
      <PageBanner eyebrow="Relatórios" icon={RiBarChartBoxLine} title="Retrato do curso" tone="violet"
        description="Como a turma de um curso está, em números agregados — para planejar oferta de disciplinas e enxergar gargalos. Ninguém é identificado: cursos com menos de 5 alunos ficam ocultos e notas não entram."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="rel-curso" className="sr-only">Curso</Label>
              <select id="rel-curso" className={cx(selectCls, "w-auto min-w-64")} value={slug}
                onChange={(e) => { setSlug(e.target.value); router.replace(`/admin/relatorios?curso=${e.target.value}`); }}>
                {list.map((c) => <option key={c.slug} value={c.slug}>{c.name} ({c.enrollments})</option>)}
              </select>
            </div>
            {ok && (
              <Button variant="secondary" onClick={() => downloadCSV(`relatorio-${ok.course.slug}`, ok.subjects, [
                { header: "seq", value: (s) => s.seq }, { header: "código", value: (s) => s.code }, { header: "disciplina", value: (s) => s.name },
                { header: "CH", value: (s) => s.hours }, { header: "aprovados", value: (s) => s.approved }, { header: "cursando", value: (s) => s.enrolled },
                { header: "aptos", value: (s) => s.apt }, { header: "pendentes", value: (s) => s.pending }, { header: "libera (transitivo)", value: (s) => s.unlocks },
              ])}><RiDownloadLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />CSV</Button>
            )}
          </div>
        }
        aside={ok ? (
          <ProgressRing value={ok.progress.avgPct} tone="violet" size={116} stroke={11} label={`integralização média de ${ok.progress.avgPct}%`}>
            <div><span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{Math.round(ok.progress.avgPct)}%</span>
              <p className="text-[0.65rem] text-gray-500 dark:text-gray-400">média da<br />integralização</p></div>
          </ProgressRing>
        ) : undefined}
      />

      {analytics.isSuccess && list.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <EmptyArt icon={RiBarChartBoxLine} /><p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Sem cursos para analisar ainda.</p>
        </div>
      )}

      {report.isLoading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}</div>}

      {r?.suppressed && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-violet-200 bg-violet-50/60 p-10 text-center dark:border-violet-500/30 dark:bg-violet-500/10">
          <span className="grid size-14 place-items-center rounded-full bg-violet-600 text-white shadow-md dark:bg-violet-500 dark:text-gray-950" aria-hidden="true"><RiEyeOffLine className="size-7" /></span>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Relatório oculto para proteger os alunos</h2>
          <p className="max-w-lg text-sm text-gray-600 dark:text-gray-300">
            {r.course.name} tem <b>{r.students}</b> aluno(s). Com menos de {r.minGroup}, qualquer média ou distribuição praticamente revela o progresso de alguém — então o servidor não calcula nada.
          </p>
        </div>
      )}

      {ok && rank && (<>
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Alunos no curso" value={ok.students} icon={RiGroupLine} tone="violet" hint={`${ok.cohorts.length} coorte(s) de ingresso`} />
          <StatTile label="Integralização média" value={ok.progress.avgPct} decimals={1} suffix="%" icon={RiPercentLine} tone="brand" hint={`mediana ${ok.progress.medianPct}%`} />
          <StatTile label="Cursando agora" value={ok.subjects.reduce((s, x) => s + x.enrolled, 0)} icon={RiPlayCircleLine} tone="blue" hint="matrículas em disciplinas neste período" />
          <StatTile label="Aptos sem cursar" value={ok.subjects.reduce((s, x) => s + x.apt, 0)} icon={RiUserStarLine} tone="amber" hint="soma, disciplina a disciplina, de alunos que já podem cursá-la" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panel className="lg:col-span-2" icon={RiBarChartBoxLine} tone="violet" id="distribuicao" title="Distribuição da integralização" description="quantos alunos em cada faixa de % concluído">
            <BarChart className="h-60" data={ok.progress.histogram.map((b) => ({ faixa: `${b.from}–${b.to}%`, Alunos: b.count }))}
              index="faixa" categories={["Alunos"]} colors={["violet"]} showLegend={false} allowDecimals={false} yAxisWidth={28}
              valueFormatter={(v) => String(v)} />
          </Panel>
          <Panel icon={RiFlagLine} tone="amber" id="marcos-rel" title="Marcos alcançados" description="% da turma">
            {ok.milestones.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">A matriz não tem marcos.</p> : (
              <div className="flex flex-wrap justify-around gap-4">
                {ok.milestones.map((m) => (
                  <div key={m.key} className="flex flex-col items-center gap-1.5">
                    <ProgressRing value={m.reachedPct} tone="amber" size={84} stroke={8} label={`${m.key}: ${m.reachedPct}% da turma`}>
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-50">{Math.round(m.reachedPct)}%</span>
                    </ProgressRing>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300" title={m.description}>{m.key}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel icon={RiStackLine} tone="cyan" id="composicoes-rel" title="Composições" description="média da turma e quantos já fecharam cada núcleo">
            <ul className="flex flex-col gap-4">
              {ok.compositions.map((c, i) => {
                const t = tone(compositionTone(c.key, i));
                return (
                  <li key={c.key}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-gray-900 dark:text-gray-50">{c.label}</span>
                      <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">média {c.avgPct}% · {c.completedPct}% fecharam</span>
                    </div>
                    <div className="relative mt-1.5 h-2.5 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className={cx("bar-grow h-full rounded-full", t.dot)} style={{ width: `${c.avgPct}%` }} />
                      <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-gray-900 dark:bg-gray-50" style={{ left: `${c.completedPct}%` }} title={`${c.completedPct}% já fecharam`} aria-hidden="true" />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Barra: média da turma. Traço: fração que já fechou o mínimo.</p>
          </Panel>
          <Panel icon={RiGroupLine} tone="emerald" id="coortes" title="Coortes de ingresso" description="alunos por período de entrada informado">
            <BarChart className="h-56" data={ok.cohorts.map((c) => ({ ingresso: c.term, Alunos: c.count }))}
              index="ingresso" categories={["Alunos"]} colors={["emerald"]} showLegend={false} allowDecimals={false} yAxisWidth={28}
              valueFormatter={(v) => String(v)} />
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panel icon={RiUserStarLine} tone="amber" id="demanda" title="Demanda para o próximo período" description="alunos aptos (requisitos cumpridos) que ainda não cursaram">
            <Ranking items={rank.apt} value={(s) => s.apt} max={ok.students} toneName="amber" unit={(n) => `${n} apto(s)`} empty="Ninguém apto a nada novo — ou a turma não marcou as disciplinas." />
          </Panel>
          <Panel icon={RiPlayCircleLine} tone="blue" id="cursando" title="Mais cursadas agora" description="marcadas como “cursando”">
            <Ranking items={rank.enrolled} value={(s) => s.enrolled} max={ok.students} toneName="blue" unit={(n) => `${n} aluno(s)`} empty="Nenhuma disciplina marcada como cursando." />
          </Panel>
          <Panel icon={RiFireLine} tone="red" id="gargalos" title="Gargalos" description="pendentes para muitos × destravam muitas outras">
            <Ranking items={rank.block} value={rank.blockFn} max={rank.blockFn(rank.block[0] ?? ok.subjects[0]!)} toneName="red"
              unit={(_, s) => `${s.pending} pend. · libera ${s.unlocks}`} empty="Sem gargalos visíveis." />
          </Panel>
        </div>

        <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <RiShieldCheckLine className="size-4 text-emerald-600" aria-hidden="true" />
          Gerado agora a partir das marcações dos alunos. “Apto” usa a mesma regra de requisitos do painel do aluno; disciplinas simuladas contam como pendentes.
          <RiLockLine className="ml-auto size-4" aria-hidden="true" /><Pill tone="violet">mín. {ok.minGroup} alunos</Pill>
        </p>
      </>)}
    </div>
  );
}
