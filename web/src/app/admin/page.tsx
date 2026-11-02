"use client";

// Admin · Visão do sistema (RF-21, v12): cadastros, acessos e atividade da instância. Só
// números OPERACIONAIS — nenhum dado acadêmico de aluno (decisão de privacidade do projeto;
// os relatórios acadêmicos são agregados por curso, em Relatórios).
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  RiBookOpenLine, RiCalendar2Line, RiFlashlightLine, RiGroupLine, RiMailSendLine, RiMegaphoneLine,
  RiPulseLine, RiShieldUserLine, RiTimeLine, RiUserAddLine, RiUserFollowLine, RiUploadCloud2Line, RiArrowRightUpLine,
} from "@remixicon/react";
import { admin } from "@/lib/api/endpoints";
import { PageBanner } from "@/components/fx/page-banner";
import { StatTile } from "@/components/fx/art";
import { ProgressRing } from "@/components/fx/progress-ring";
import { CountUp } from "@/components/fx/count-up";
import { Heatmap } from "@/components/fx/heatmap";
import { Donut, DonutLegend } from "@/components/fx/donut";
import { Panel, Pill } from "@/components/admin/panel";
import { AreaChart } from "@/components/tremor/AreaChart";
import { BarList } from "@/components/tremor/BarList";
import { Button } from "@/components/tremor/Button";
import { actorName, auditLabel } from "@/lib/audit-labels";
import { tone } from "@/lib/palette";
import { cx, fmtDate, num, timeAgo } from "@/lib/utils";

const weekFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

export default function AdminHomePage() {
  const { data: a, isLoading } = useQuery({ queryKey: ["admin-analytics"], queryFn: admin.analytics, refetchInterval: 60_000 });
  const { data: periods } = useQuery({ queryKey: ["admin-periods"], queryFn: admin.periods });
  const { data: m } = useQuery({ queryKey: ["metrics"], queryFn: admin.metrics, refetchInterval: 15_000 });
  const cur = periods?.current;

  const enrollments = a?.courses.reduce((s, c) => s + c.enrollments, 0) ?? 0;
  const activePct = a && a.users.total ? Math.round((a.users.active7d / a.users.total) * 100) : 0;
  const weekly = a?.signupsByWeek.map((w) => w.count) ?? [];
  const lastWeek = weekly.at(-1) ?? 0, prevWeek = weekly.at(-2) ?? 0;
  const err = m && m.http.total ? m.http.status.s5xx / m.http.total : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageBanner
        eyebrow="Administração" icon={RiShieldUserLine} title="Visão do sistema"
        description="Cadastros, acessos e atividade da instância. São números de conta e de uso — o progresso dos alunos só aparece agregado, em Relatórios."
        actions={<>
          <Button asChild><Link href="/admin/usuarios?novo=1"><RiUserAddLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Convidar usuário</Link></Button>
          <Button asChild variant="secondary"><Link href="/admin/cursos?importar=1"><RiUploadCloud2Line className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Importar matriz</Link></Button>
          <Button asChild variant="secondary"><Link href="/admin/avisos?novo=1"><RiMegaphoneLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Publicar aviso</Link></Button>
        </>}
        aside={
          <div className="flex items-center gap-5">
            <ProgressRing value={activePct} size={112} stroke={10} label={`${activePct}% das contas ativas nos últimos 7 dias`}>
              <div>
                <CountUp value={activePct} suffix="%" className="text-xl font-semibold text-gray-900 dark:text-gray-50" />
                <p className="text-[0.65rem] leading-tight text-gray-500 dark:text-gray-400">ativas<br />em 7 dias</p>
              </div>
            </ProgressRing>
            <div className="hidden flex-col gap-2 sm:flex">
              {cur ? <Pill tone={cur.onBreak ? "violet" : "emerald"}>{cur.onBreak ? "Férias" : `Período ${cur.label}`}</Pill> : <span className="skeleton h-5 w-24" />}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {cur?.nextStartsAt ? <>próximo: <b className="font-medium text-gray-700 dark:text-gray-300">{cur.nextTerm}</b> em {fmtDate.format(new Date(cur.nextStartsAt))}</> : "sem virada agendada"}
              </p>
              <Link href="/admin/periodos" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">Calendário →</Link>
            </div>
          </div>
        }
      />

      {/* números da instância */}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {isLoading || !a ? [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-36" />) : (<>
          <StatTile label="Contas" value={a.users.total} icon={RiGroupLine} tone="brand" trend={cumulative(weekly, a.users.total)}
            hint={`${a.users.students} aluno(s) · ${a.users.admins} admin(s)`} />
          <StatTile label="Ativas em 7 dias" value={a.users.active7d} icon={RiUserFollowLine} tone="emerald"
            hint={`${a.users.active30d} nos últimos 30 dias`} />
          <StatTile label="Novas no mês" value={a.users.new30d} icon={RiUserAddLine} tone="blue" trend={weekly}
            delta={prevWeek || lastWeek ? { value: `${lastWeek - prevWeek >= 0 ? "+" : ""}${lastWeek - prevWeek} na semana`, positive: lastWeek >= prevWeek } : null}
            hint={`${a.users.new7d} nos últimos 7 dias`} />
          <StatTile label="Matrículas" value={enrollments} icon={RiBookOpenLine} tone="violet"
            hint={`em ${a.courses.length} curso(s) · ${a.users.withoutCourse} aluno(s) sem curso`} />
          <StatTile label="Convites pendentes" value={a.users.pendingInvites} icon={RiMailSendLine} tone="amber"
            hint={a.users.pendingInvites ? <Link href="/admin/usuarios?filtro=pendentes" className="font-medium text-amber-700 hover:underline dark:text-amber-400">ver quem falta →</Link> : "ninguém esperando"} />
        </>)}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" icon={RiUserAddLine} tone="blue" id="cadastros"
          title="Cadastros por semana" description="últimas 12 semanas (segunda a domingo, UTC)">
          {!a ? <div className="skeleton h-56" /> : (
            <AreaChart className="h-56" data={a.signupsByWeek.map((w) => ({ semana: weekFmt.format(new Date(`${w.date}T00:00:00Z`)), Cadastros: w.count }))}
              index="semana" categories={["Cadastros"]} colors={["blue"]} showLegend={false} allowDecimals={false}
              valueFormatter={(v) => String(v)} fill="gradient"  yAxisWidth={32} />
          )}
        </Panel>
        <Panel icon={RiGroupLine} tone="violet" id="contas" title="Contas" description="por papel e situação">
          {!a ? <div className="skeleton h-56" /> : (() => {
            const slices = [
              { label: "Alunos com curso", value: Math.max(0, a.users.students - a.users.withoutCourse), tone: "emerald" },
              { label: "Alunos sem curso", value: a.users.withoutCourse, tone: "amber" },
              { label: "Administradores", value: a.users.admins, tone: "violet" },
            ];
            return (
              <div className="flex flex-col items-center gap-5">
                <Donut data={slices} label="Contas por papel" size={136}>
                  <div><CountUp value={a.users.total} className="text-2xl font-semibold text-gray-900 dark:text-gray-50" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">contas</p></div>
                </Donut>
                <div className="w-full"><DonutLegend data={slices} /></div>
              </div>
            );
          })()}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" icon={RiFlashlightLine} tone="brand" id="acessos"
          title="Logins por dia" description="últimas 26 semanas — cada quadrado é um dia; passe o mouse para ver o número">
          {!a ? <div className="skeleton h-32" /> : (
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
              <div className="min-w-0 flex-1"><Heatmap data={a.loginsByDay} unit="login" label="Logins por dia" /></div>
              <LoginSummary data={a.loginsByDay} />
            </div>
          )}
        </Panel>
        <Panel icon={RiTimeLine} tone="cyan" id="atividade" title="Atividade recente"
          action={<Link href="/admin/auditoria" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">Auditoria →</Link>}
          bodyClassName="p-0">
          {!a ? <div className="skeleton m-5 h-48" /> : a.recent.length === 0 ? (
            <p className="p-5 text-sm text-gray-500 dark:text-gray-400">Nada registrado ainda.</p>
          ) : (
            <ol className="stagger divide-y divide-gray-100 dark:divide-gray-900">
              {a.recent.slice(0, 7).map((e) => {
                const l = auditLabel(e); const Icon = l.icon;
                return (
                  <li key={e.id} className="flex items-start gap-3 px-5 py-2.5">
                    <span className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset", tone(l.tone).soft)}>
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <p className="min-w-0 flex-1 text-sm text-gray-700 dark:text-gray-300">
                      <b className="font-medium text-gray-900 dark:text-gray-50">{actorName(e)}</b> {l.line}
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{timeAgo(e.createdAt)}</span>
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" icon={RiBookOpenLine} tone="violet" id="por-curso" title="Matrículas por curso"
          action={<Link href="/admin/relatorios" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">Relatórios →</Link>}>
          {!a ? <div className="skeleton h-32" /> : a.courses.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum curso ainda — <Link href="/admin/cursos?importar=1" className="text-brand-700 underline dark:text-brand-400">importe uma matriz</Link>.</p>
          ) : (
            <BarList data={a.courses.map((c) => ({ name: c.name, value: c.enrollments, href: `/admin/relatorios?curso=${c.slug}` }))}
              valueFormatter={(v) => `${num(v)} aluno(s)`} />
          )}
        </Panel>
        <Panel icon={RiPulseLine} tone="emerald" id="saude" title="Saúde agora"
          action={<Link href="/admin/monitor" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">Monitor <RiArrowRightUpLine className="size-3.5" aria-hidden="true" /></Link>}>
          {!m ? <div className="skeleton h-32" /> : (
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span className={cx("live-dot", m.db.ok ? "text-emerald-500" : "text-red-500")} aria-hidden="true" /> Banco de dados
                </span>
                <Pill tone={m.db.ok ? "emerald" : "red"}>{m.db.ok ? `ok · ${m.db.pingMs} ms` : "falha"}</Pill>
              </li>
              <li className="flex items-center justify-between text-gray-700 dark:text-gray-300">Latência p95 <b className="font-semibold tabular-nums text-gray-900 dark:text-gray-50">{m.http.latencyMs.p95 ?? "—"} ms</b></li>
              <li className="flex items-center justify-between text-gray-700 dark:text-gray-300">Erros 5xx <b className={cx("font-semibold tabular-nums", err > 0.01 ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-gray-50")}>{(err * 100).toFixed(1)}%</b></li>
              <li className="flex items-center justify-between text-gray-700 dark:text-gray-300">Avisos no ar <b className="font-semibold tabular-nums text-gray-900 dark:text-gray-50">{a?.announcements.live ?? "…"}{a?.announcements.scheduled ? <span className="ml-1 text-xs font-normal text-gray-500">+{a.announcements.scheduled} agendado(s)</span> : null}</b></li>
              <li className="flex items-center justify-between text-gray-700 dark:text-gray-300"><span className="flex items-center gap-1.5"><RiCalendar2Line className="size-4 text-gray-400" aria-hidden="true" />Disciplinas marcadas</span><b className="font-semibold tabular-nums text-gray-900 dark:text-gray-50">{a ? num(a.activity.subjectStatuses) : "…"}</b></li>
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Resumo ao lado do mapa de calor: total, média, pico e o dia da semana mais movimentado. */
function LoginSummary({ data }: { data: { date: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const peak = data.reduce((m, d) => (d.count > m.count ? d : m), data[0]!);
  const byDow = Array(7).fill(0) as number[];
  for (const d of data) { const w = new Date(`${d.date}T00:00:00Z`).getUTCDay(); byDow[w] = (byDow[w] ?? 0) + d.count; }
  const busiest = byDow.indexOf(Math.max(...byDow));
  const items: [string, React.ReactNode][] = [
    ["Logins no período", <CountUp key="t" value={total} />],
    ["Média por dia", (total / data.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 })],
    ["Dia de pico", peak.count ? `${peak.count} em ${weekFmt.format(new Date(`${peak.date}T00:00:00Z`))}` : "—"],
    ["Dia da semana mais movimentado", total ? WEEKDAY[busiest] : "—"],
  ];
  return (
    <dl className="grid shrink-0 grid-cols-2 gap-3 xl:w-56 xl:grid-cols-1">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-md border border-dashed border-gray-200 px-3 py-2 dark:border-gray-800">
          <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
          <dd className="text-sm font-semibold text-gray-900 dark:text-gray-50">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Total acumulado de contas semana a semana (termina no total atual). */
function cumulative(weekly: number[], total: number) {
  const added = weekly.reduce((s, n) => s + n, 0);
  let acc = Math.max(0, total - added);
  return weekly.map((n) => (acc += n));
}
