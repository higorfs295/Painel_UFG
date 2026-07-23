"use client";

// Admin · Visão do sistema (RF-21): números da instância, crescimento, distribuição por
// curso e estado do calendário — com atalhos para as telas de gestão.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { admin } from "@/lib/api/endpoints";
import { BarList, ChartTitle, MetricCard } from "@/components/charts";
import { Card, Chip, EmptyState, PageHead, Section } from "@/components/ui";
import {
  IconBook, IconCal, IconFlame, IconGrid, IconMegaphone, IconPulse, IconServer, IconSprout, IconUsers,
} from "@/components/ui/icons";
import { fmtDate, num } from "@/lib/utils";

const ATALHOS = [
  { href: "/admin/usuarios", icon: IconUsers, title: "Usuários", text: "criar, convidar, papéis e matrículas" },
  { href: "/admin/cursos", icon: IconBook, title: "Cursos", text: "importar matrizes e lixeira" },
  { href: "/admin/periodos", icon: IconCal, title: "Períodos", text: "calendário acadêmico global" },
  { href: "/admin/avisos", icon: IconMegaphone, title: "Avisos", text: "comunicados por audiência" },
  { href: "/admin/monitor", icon: IconPulse, title: "Monitor", text: "métricas e auditoria" },
  { href: "/admin/config", icon: IconServer, title: "Configurações", text: "instância, SMTP e ferramentas" },
];

export default function AdminHomePage() {
  const { data: s } = useQuery({ queryKey: ["admin-stats"], queryFn: admin.stats });
  const { data: periods } = useQuery({ queryKey: ["admin-periods"], queryFn: admin.periods });
  const cur = periods?.current;

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="administração" title="Visão do sistema" />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <ChartTitle icon={IconUsers} title="Usuários" />
          <p className="font-display mt-3 text-4xl font-semibold tracking-tight">{s ? num(s.users.total) : "…"}</p>
          <p className="text-subtle-foreground mt-1 text-xs">
            {s ? `${s.users.admins} admin(s) · ${s.users.pendingInvites} convite(s) pendente(s)` : ""}
          </p>
        </Card>
        <Card>
          <ChartTitle icon={IconSprout} title="Novos (30 dias)" />
          <p className="font-display text-savanna mt-3 text-4xl font-semibold tracking-tight">
            {s ? `+${num(s.users.newUsers30d)}` : "…"}
          </p>
          <p className="text-subtle-foreground mt-1 text-xs">crescimento recente de contas</p>
        </Card>
        <Card>
          <ChartTitle icon={IconBook} title="Cursos" />
          <p className="font-display mt-3 text-4xl font-semibold tracking-tight">{s ? num(s.courses) : "…"}</p>
          <p className="text-subtle-foreground mt-1 text-xs">{s ? `${num(s.enrollments)} matrícula(s)` : ""}</p>
        </Card>
        <Card>
          <ChartTitle icon={IconFlame} title="Disciplinas marcadas" />
          <p className="font-display mt-3 text-4xl font-semibold tracking-tight">
            {s ? num(s.activity.subjectStatuses) : "…"}
          </p>
          <p className="text-subtle-foreground mt-1 text-xs">
            {s ? `${num(s.activity.extras)} extras · ${num(s.activity.scenarios)} cenários` : ""}
          </p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <ChartTitle icon={IconGrid} title="Matrículas por curso" />
          <div className="mt-5">
            {!s ? <div className="skeleton h-32" /> : s.byCourse.length === 0 ? (
              <EmptyState>Nenhuma matrícula ainda.</EmptyState>
            ) : (
              <BarList data={s.byCourse.map((c) => ({ label: c.slug, value: c.count, hint: c.name }))} />
            )}
          </div>
        </Card>

        <Section title="Período letivo" hint="calendário global (RF-20 v2)"
          action={<Link href="/admin/periodos" className="text-primary text-xs hover:underline">Gerir →</Link>}>
          {!cur ? <div className="skeleton h-24" /> : (
            <>
              <div className="flex items-center gap-2">
                <Chip tone={cur.onBreak ? "sim" : "avail"}>{cur.onBreak ? "Férias" : cur.label}</Chip>
                <span className="text-subtle-foreground text-xs">
                  {cur.source === "calendar" ? "do calendário" : "sugerido pelo mês"}
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <MetricCard title="Próximo período" value={cur.nextTerm}
                  sub={cur.nextStartsAt ? `a partir de ${fmtDate.format(new Date(cur.nextStartsAt))}` : "sem data agendada"} />
              </div>
            </>
          )}
        </Section>
      </div>

      <Section title="Atalhos">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ATALHOS.map(({ href, icon: Icon, title, text }) => (
            <Link key={href} href={href}
              className="bg-card hover:border-ring/50 group flex flex-col gap-1.5 rounded-xl border p-5 shadow-sm transition-[border-color,box-shadow] hover:shadow-md">
              <span className="text-primary"><Icon /></span>
              <strong className="font-display text-foreground text-lg font-semibold tracking-tight">{title}</strong>
              <span className="text-muted-foreground text-sm">{text}</span>
              <span className="text-primary mt-2 text-xs font-semibold tracking-[0.12em] uppercase transition-transform group-hover:translate-x-1">
                abrir →
              </span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
