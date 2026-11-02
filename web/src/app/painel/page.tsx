"use client";

// Visão geral — o "Overview" do tremorlabs/template-dashboard com os dados do curso.
//
// Mesma composição do template: título da seção, três cartões lado a lado (gap-14, sem
// caixa) e, abaixo, uma seção de gráficos de linha por período. O "ciclo de cobrança"
// virou a integralização; "Overview" virou o ritmo por período. Cada bloco carrega e
// falha sozinho (estados do TanStack Query).
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  RiBookOpenLine, RiCheckboxCircleLine, RiDashboardLine, RiFlagLine, RiPlayCircleLine, RiSparkling2Line, RiLockUnlockLine,
} from "@remixicon/react";
import { useAuth } from "@/lib/auth-store";
import { compositionTone } from "@/lib/palette";
import { PageBanner } from "@/components/fx/page-banner";
import { ProgressRing } from "@/components/fx/progress-ring";
import { CountUp } from "@/components/fx/count-up";
import { StatTile } from "@/components/fx/art";
import { fireConfetti } from "@/components/fx/confetti";
import { me } from "@/lib/api/endpoints";
import { useApp } from "@/lib/auth-store";
import { useHistory, useProgress, useRecommendations, useTasks } from "@/hooks/use-progress";
import { CategoryBarCard, ChartCard, ProgressBarCard } from "@/components/overview/cards";
import { Badge } from "@/components/tremor/Badge";
import { Button } from "@/components/tremor/Button";
import { Divider } from "@/components/tremor/Divider";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from "@/components/tremor/Table";
import { cx, dec, num } from "@/lib/utils";

/** Soma N períodos a "AAAA.S" (S = 1 ou 2). */
function addTerms(term: string, n: number) {
  const [y, s] = term.split(".").map(Number) as [number, number];
  let year = y, sem = s;
  for (let i = 0; i < n; i++) { if (sem === 1) sem = 2; else { sem = 1; year++; } }
  return `${year}.${sem}`;
}

const h = (n: number) => `${num(n)} h`;

function SectionTitle({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cx("scroll-mt-10 text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50", className)}>
      {children}
    </h2>
  );
}

export default function VisaoGeralPage() {
  const { data: prog, isLoading, isError, refetch } = useProgress();
  const enrollmentId = useApp((s) => s.enrollmentId);
  const { data: enrollments } = useQuery({ queryKey: ["enrollments"], queryFn: me.enrollments });
  const course = enrollments?.find((e) => e.id === enrollmentId)?.course;
  const firstName = useAuth((s) => s.user?.name)?.split(" ")[0];
  useMilestoneConfetti(prog?.milestones, prog?.compositions);

  if (isError) {
    return (
      <section>
        <h1>Visão geral</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Não foi possível carregar o progresso.</p>
        <Button variant="secondary" className="mt-4" onClick={() => refetch()}>Tentar novamente</Button>
      </section>
    );
  }

  if (isLoading || !prog) {
    return (
      <div className="flex flex-col gap-8">
        <div className="skeleton h-7 w-48" />
        <div className="grid grid-cols-1 gap-14 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-64" />)}
        </div>
      </div>
    );
  }

  const total = prog.subjects.length;
  const done = prog.subjects.filter((s) => s.status === "done").length;
  const enrolled = prog.subjects.filter((s) => s.state === "ENROLLED").length;
  const avail = prog.subjects.filter((s) => s.status === "avail" && s.state !== "ENROLLED").length;
  const rest = Math.max(0, total - done - enrolled - avail);
  const reached = prog.milestones.filter((m) => m.reached).length;
  const next = prog.milestones.find((m) => !m.reached);
  const projecting = prog.projected.totals.hours !== prog.totals.hours;
  const pctOf = (n: number) => (total ? (n / total) * 100 : 0);

  return (
    <>
      <PageBanner
        eyebrow={firstName ? `Olá, ${firstName}` : "Meu painel"} icon={RiDashboardLine} title="Visão geral"
        description={course?.name}
        actions={<>
          <Button asChild><Link href="/painel/disciplinas"><RiBookOpenLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Marcar disciplinas</Link></Button>
          <Button asChild variant="secondary"><Link href="/painel/recomendacoes"><RiSparkling2Line className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />O que cursar</Link></Button>
        </>}
        aside={
          <ProgressRing value={prog.totals.pct} size={128} stroke={12} label={`${prog.totals.pct.toFixed(1)}% integralizado`}>
            <div>
              <CountUp value={prog.totals.pct} decimals={1} suffix="%" className="text-xl font-semibold text-gray-900 dark:text-gray-50" />
              <p className="text-[0.65rem] leading-tight text-gray-500 dark:text-gray-400">integralizado<br />{num(prog.totals.hours)} de {num(prog.totals.required)} h</p>
            </div>
          </ProgressRing>
        }
      />

      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Aprovadas" value={done} icon={RiCheckboxCircleLine} tone="emerald" hint={`de ${total} na matriz`} />
        <StatTile label="Cursando agora" value={enrolled} icon={RiPlayCircleLine} tone="blue" hint={enrolled ? "conta na projeção" : "nenhuma marcada"} />
        <StatTile label="Disponíveis" value={avail} icon={RiLockUnlockLine} tone="amber" hint="requisitos cumpridos" />
        <StatTile label="Marcos de horas" value={reached} suffix={` de ${prog.milestones.length}`} icon={RiFlagLine} tone="violet"
          hint={next ? `${next.key} em ${num(Math.max(0, next.hours - prog.totals.hours))} h` : "todos alcançados"} />
      </div>

      <section aria-labelledby="integralizacao" className="mt-10">
        <h2 id="integralizacao" className="sr-only">Integralização</h2>
        <div className="grid grid-cols-1 gap-14 sm:grid-cols-2 xl:grid-cols-3">
          <ProgressBarCard
            title="Integralização"
            change={projecting ? `${h(prog.projected.totals.hours)} projetado` : undefined}
            value={`${prog.totals.pct.toFixed(1).replace(".", ",")}%`}
            valueDescription={`${h(prog.totals.hours)} de ${h(prog.totals.required)}`}
            data={prog.compositions.map((c, i) => ({
              title: c.label, percentage: c.pct, current: num(c.hours), allowed: num(c.required), unit: " h",
              tone: compositionTone(c.key, i),
            }))}
            ctaDescription="Cada núcleo soma só até o mínimo exigido."
            ctaText="Ver a regra."
            ctaLink="/ajuda"
          />
          <ProgressBarCard
            title="Marcos de horas"
            change={`${reached} de ${prog.milestones.length}`}
            value={next ? next.key : "Concluídos"}
            valueDescription={next ? `faltam ${h(Math.max(0, next.hours - prog.totals.hours))}` : "todos os marcos alcançados"}
            data={prog.milestones.map((m) => ({
              title: `${m.key} · ${m.description.replace(/^Destrava\s+/i, "")}`, hint: m.description,
              percentage: Math.min(100, (prog.totals.hours / m.hours) * 100),
              current: num(Math.min(prog.totals.hours, m.hours)), allowed: num(m.hours), unit: " h",
              tone: m.reached ? "emerald" : "amber",
            }))}
            ctaDescription="Marcos destravam disciplinas que exigem horas integralizadas."
            ctaText="Abrir o mapa."
            ctaLink="/painel/mapa"
          />
          <CategoryBarCard
            title="Disciplinas"
            change={enrolled ? `${enrolled} cursando` : undefined}
            value={num(done)}
            valueDescription={`concluídas de ${total}`}
            subtitle="Situação na matriz"
            data={[
              { title: "Concluídas", percentage: pctOf(done), value: String(done), color: "bg-emerald-600 dark:bg-emerald-500" },
              { title: "Cursando", percentage: pctOf(enrolled), value: String(enrolled), color: "bg-blue-600 dark:bg-blue-500" },
              { title: "Disponíveis", percentage: pctOf(avail), value: String(avail), color: "bg-amber-600 dark:bg-amber-500" },
              { title: "Bloqueadas ou simuladas", percentage: pctOf(rest), value: String(rest), color: "bg-gray-400 dark:bg-gray-600" },
            ]}
            ctaDescription="Marque o que já cursou em"
            ctaText="Disciplinas."
            ctaLink="/painel/disciplinas"
          />
        </div>
      </section>

      <RitmoSection />
      <ProximosPassos />
    </>
  );
}

/**
 * Confete quando um marco de horas é alcançado ou uma composição fecha 100% DURANTE a sessão
 * (comparando com o valor anterior) — nunca ao simplesmente abrir a página.
 */
function useMilestoneConfetti(
  milestones: { key: string; reached: boolean }[] | undefined,
  compositions: { key: string; pct: number }[] | undefined,
) {
  const prev = useRef<{ reached: Set<string>; full: Set<string> } | null>(null);
  useEffect(() => {
    if (!milestones || !compositions) return;
    const reached = new Set(milestones.filter((m) => m.reached).map((m) => m.key));
    const full = new Set(compositions.filter((c) => c.pct >= 100).map((c) => c.key));
    const before = prev.current;
    if (before && ([...reached].some((k) => !before.reached.has(k)) || [...full].some((k) => !before.full.has(k)))) {
      fireConfetti();
    }
    prev.current = { reached, full };
  }, [milestones, compositions]);
}

/** "Overview" do template: um gráfico de linha por métrica, por período letivo. */
function RitmoSection() {
  const { data, isLoading } = useHistory();
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: me.profile, staleTime: 5 * 60_000 });

  const left = data?.pace.estTermsLeft ?? null;
  const base = profile?.period?.term ?? profile?.period?.nextTerm ?? null;
  const target = left != null && base ? addTerms(base, Math.max(0, left - (profile?.period?.onBreak ? 1 : 0))) : null;

  return (
    <section aria-labelledby="ritmo">
      <SectionTitle id="ritmo" className="mt-16">Ritmo</SectionTitle>
      <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white pt-4 pb-4 sm:pt-6 lg:top-0 lg:pt-8 dark:border-gray-800 dark:bg-gray-950">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Por período letivo, a partir das disciplinas aprovadas com período informado.
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Formatura estimada</span>
          <Badge variant={target ? "default" : "neutral"}>{target ? `~${target}` : "sem dados"}</Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 grid grid-cols-1 gap-14 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-48" />)}
        </div>
      ) : !data || data.terms.length === 0 ? (
        <p className="mt-10 max-w-2xl rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
          Ainda não há períodos registrados. Ao lançar a nota de uma disciplina aprovada, informe o
          período (ex.: 2024.1) — é daí que saem estes gráficos e a estimativa de formatura.
        </p>
      ) : (
        <dl className="mt-10 grid grid-cols-1 gap-14 md:grid-cols-2 xl:grid-cols-3">
          <ChartCard title="Horas por período" format={(v) => h(v)}
            points={data.terms.map((t) => ({ label: t.term, value: t.hours }))} />
          <ChartCard title="Média por período" format={(v) => dec(v)}
            points={data.terms.map((t) => ({ label: t.term, value: t.avg }))} />
          <ChartCard title="Disciplinas por período" format={(v) => num(v)}
            points={data.terms.map((t) => ({ label: t.term, value: t.count }))} />
        </dl>
      )}

      {data && data.terms.length > 0 && (
        <p className="mt-8 text-xs text-gray-500 dark:text-gray-400">
          MGA {dec(data.mga)} · ritmo médio {data.pace.avgHoursPerTerm ?? "—"} h por período
          {left != null && <> · cerca de {left} período(s) restante(s), sem considerar oferta de turmas nem trancamentos</>}.
        </p>
      )}
    </section>
  );
}

/** O que cursar e o que vence: os dois "próximos passos" lado a lado. */
function ProximosPassos() {
  const { data: recs } = useRecommendations(8);
  const { data: tasks } = useTasks();
  const now = Date.now();
  const upcoming = (tasks ?? [])
    .filter((t) => !t.done && t.dueAt)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
    .slice(0, 5);

  return (
    <section aria-labelledby="proximos" className="mt-16">
      <SectionTitle id="proximos">Próximos passos</SectionTitle>
      <Divider className="mt-4 mb-8" />
      <div className="grid grid-cols-1 gap-14 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 sm:text-sm dark:text-gray-50">O que mais destrava</h3>
            <Link href="/painel/recomendacoes" className="text-sm text-brand-700 hover:underline dark:text-brand-400">Ver todas</Link>
          </div>
          {!recs ? <div className="skeleton mt-4 h-48" /> : recs.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Nada disponível no momento.</p>
          ) : (
            <TableRoot className="mt-2">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Disciplina</TableHeaderCell>
                    <TableHeaderCell>Código</TableHeaderCell>
                    <TableHeaderCell className="text-right">CH</TableHeaderCell>
                    <TableHeaderCell className="text-right">Destrava</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recs.slice(0, 6).map((r) => (
                    <TableRow key={r.seq}>
                      <TableCell className="font-medium text-gray-900 dark:text-gray-50">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.hours} h</TableCell>
                      <TableCell className="text-right tabular-nums" title="disciplinas liberadas direta e indiretamente">{r.tot}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableRoot>
          )}
        </div>

        <div className="xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 sm:text-sm dark:text-gray-50">Próximos prazos</h3>
            <Link href="/painel/agenda" className="text-sm text-brand-700 hover:underline dark:text-brand-400">Agenda</Link>
          </div>
          {!tasks ? <div className="skeleton mt-4 h-40" /> : upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Nenhum prazo pendente. Cadastre provas e entregas na Agenda.</p>
          ) : (
            <ul role="list" className="mt-2 divide-y divide-gray-200 dark:divide-gray-800">
              {upcoming.map((t) => {
                const days = Math.ceil((new Date(t.dueAt!).getTime() - now) / 86_400_000);
                const variant = days < 0 ? "error" : days <= 3 ? "warning" : "neutral";
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">{t.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t.kind.charAt(0) + t.kind.slice(1).toLowerCase()}{t.subjectCode ? ` · ${t.subjectCode}` : ""}
                      </p>
                    </div>
                    <Badge variant={variant}>{days < 0 ? `${-days} d atrás` : days === 0 ? "hoje" : `em ${days} d`}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
