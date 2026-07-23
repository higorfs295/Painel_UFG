"use client";

// Visão geral — o "dashboard" do aluno.
//
// A composição segue o visactor-next-template: cada bloco é um cartão com título+ícone,
// métricas ao lado do desenho. Cada bloco também carrega e falha sozinho, então uma
// consulta lenta (o feed de avisos, por exemplo) não segura o resto da página — é a mesma
// ideia de "ilhas" do next-partial-prerendering, aqui com os estados do TanStack Query.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { announcements } from "@/lib/api/endpoints";
import { useHistory, useProgress, useRecommendations } from "@/hooks/use-progress";
import { AreaSpark, ChartTitle, DonutProgress, MetricCard, StackedBar } from "@/components/charts";
import { Bar, Card, Chip, EmptyState, PageHead, Section } from "@/components/ui";
import Button from "@/components/ui/button";
import {
  IconCheck, IconFlame, IconStar, IconTarget,
} from "@/components/ui/icons";
import { num } from "@/lib/utils";

const COMP_COLORS = [
  "var(--color-primary)", "var(--color-jenipapo)", "var(--color-dusk)",
  "var(--color-savanna)", "var(--color-sun)", "var(--color-ember)",
];

function BlockSkeleton({ className = "h-52" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function VisaoGeralPage() {
  const { data: prog, isLoading, isError, refetch } = useProgress();
  const { data: recs } = useRecommendations(8);
  const { data: feed } = useQuery({ queryKey: ["announcements-feed"], queryFn: announcements.feed });

  if (isError) {
    return (
      <EmptyState>
        Não foi possível carregar o progresso.{" "}
        <Button size="sm" onClick={() => refetch()} className="ml-2">Tentar novamente</Button>
      </EmptyState>
    );
  }

  if (isLoading || !prog) {
    return (
      <div className="flex flex-col gap-5">
        <BlockSkeleton className="h-16 w-72" />
        <div className="grid gap-5 lg:grid-cols-3">
          <BlockSkeleton className="h-64 lg:col-span-2" />
          <BlockSkeleton className="h-64" />
        </div>
        <BlockSkeleton />
      </div>
    );
  }

  const done = prog.subjects.filter((s) => s.status === "done").length;
  const avail = prog.subjects.filter((s) => s.status === "avail").length;
  const nextMilestone = prog.milestones.find((m) => !m.reached);
  const projecting = prog.projected.totals.hours !== prog.totals.hours;

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="sua jornada" title="Visão geral">
        <Link href="/painel/recomendacoes"><Button size="sm">O que cursar agora →</Button></Link>
      </PageHead>

      {/* ── integralização + composições ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <ChartTitle icon={IconTarget} title="Integralização" />
          <div className="mt-5 flex flex-wrap items-center gap-8">
            <DonutProgress pct={prog.totals.pct} label="integralizado" />
            <div className="flex min-w-[200px] flex-1 flex-col gap-4">
              <MetricCard title="Horas integralizadas" value={`${num(prog.totals.hours)}h`}
                sub={`de ${num(prog.totals.required)}h exigidas`} />
              <MetricCard title="Disciplinas concluídas" value={done}
                sub={`${avail} disponíveis agora`} color="var(--color-savanna)" />
              {projecting && (
                <MetricCard title="Projetado (com simuladas)" value={`${num(prog.projected.totals.hours)}h`}
                  color="var(--color-sim)" />
              )}
            </div>
          </div>

          <div className="mt-6 border-t pt-5">
            <StackedBar parts={prog.compositions.map((c, i) => ({
              label: c.label, value: c.hours, color: COMP_COLORS[i % COMP_COLORS.length]!,
            }))} />
          </div>
        </Card>

        <Section title="Próximo marco" hint={nextMilestone ? nextMilestone.description : "todos alcançados"}>
          {nextMilestone ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold tracking-tight">{num(nextMilestone.hours)}h</span>
                <Chip tone="avail">{nextMilestone.key}</Chip>
              </div>
              <p className="text-muted-foreground mt-3 text-sm">
                Faltam <b className="text-foreground">{num(Math.max(0, nextMilestone.hours - prog.totals.hours))}h</b> para
                chegar lá.
              </p>
              <Bar className="mt-4" pct={(prog.totals.hours / nextMilestone.hours) * 100} />
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Você já cruzou todos os marcos de horas do curso.</p>
          )}

          <ul className="mt-5 flex flex-wrap gap-2">
            {prog.milestones.map((m) => (
              <li key={m.key}>
                <Chip tone={m.reached ? "done" : "neutral"}>{m.key} · {num(m.hours)}h</Chip>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* ── composições em detalhe ── */}
      <Section title="Composições curriculares"
        hint="cada uma soma até o mínimo exigido; o excedente aparece à parte">
        <ul className="grid gap-4 sm:grid-cols-2">
          {prog.compositions.map((c) => (
            <li key={c.key}>
              <div className="text-muted-foreground mb-1.5 flex justify-between gap-3 text-sm">
                <span>{c.label}</span>
                <span>
                  {num(c.hours)}/{num(c.required)}h{" "}
                  {c.over > 0 && <b className="text-savanna">(+{num(c.over)}h)</b>}
                </span>
              </div>
              <Bar pct={c.pct} />
            </li>
          ))}
        </ul>
      </Section>

      {/* ── recomendações + avisos ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ChartTitle icon={IconStar} title="O que mais destrava" />
            <Link href="/painel/recomendacoes">
              <Button variant="ghost" size="sm">Ver todas →</Button>
            </Link>
          </div>
          {!recs ? <BlockSkeleton className="mt-4 h-40" /> : recs.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">Nada disponível no momento.</p>
          ) : (
            <ul className="mt-4 divide-y">
              {recs.slice(0, 6).map((r, i) => (
                <li key={r.seq} className="flex items-center gap-3 py-2.5">
                  <span className="font-display text-primary/50 w-7 shrink-0 text-lg font-semibold">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm font-medium">{r.name}</b>
                    <small className="text-subtle-foreground font-mono text-xs">{r.code} · {r.hours}h</small>
                  </span>
                  <Chip tone="avail">destrava {r.tot}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Section title="Avisos" hint={feed?.length ? undefined : "nada por enquanto"}>
          {!feed ? <BlockSkeleton className="h-32" /> : feed.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum aviso publicado.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {feed.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <div className="flex items-center gap-2">
                    {a.pinned && <IconFlame className="text-ember shrink-0" />}
                    <b className="text-sm font-medium">{a.title}</b>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ── ritmo ── */}
      <RitmoBlock />
    </div>
  );
}

/** Bloco de ritmo: carrega o histórico por conta própria (falha isolada do resto). */
function RitmoBlock() {
  const { data, isLoading } = useHistory();
  if (isLoading) return <BlockSkeleton className="h-40" />;
  if (!data || data.terms.length === 0) {
    return (
      <Section title="Ritmo por período">
        <EmptyState>
          Informe o período (ex.: 2024.1) ao marcar disciplinas como aprovadas e o gráfico de ritmo
          aparece aqui.
        </EmptyState>
      </Section>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChartTitle icon={IconCheck} title="Ritmo por período" />
        <Link href="/painel/historico"><Button variant="ghost" size="sm">Histórico completo →</Button></Link>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-8">
        <div className="min-w-[220px] flex-1">
          <AreaSpark points={data.terms.map((t) => ({ x: t.term, y: t.hours }))} />
          <div className="text-subtle-foreground mt-1 flex justify-between text-[0.7rem]">
            <span>{data.terms[0]?.term}</span>
            <span>{data.terms[data.terms.length - 1]?.term}</span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <MetricCard title="Média global (MGA)" value={data.mga != null ? data.mga.toFixed(2).replace(".", ",") : "—"}
            sub="ponderada pela carga horária" />
          <MetricCard title="Ritmo por período" value={data.pace.avgHoursPerTerm != null ? `${data.pace.avgHoursPerTerm}h` : "—"}
            color="var(--color-jenipapo)" />
          <MetricCard title="Períodos restantes (est.)" value={data.pace.estTermsLeft ?? "—"}
            color="var(--color-dusk)" />
        </div>
      </div>
    </Card>
  );
}
