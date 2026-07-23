"use client";

// RF-27 — Monitor: observabilidade da instância (saúde, latências, rotas, erros) e a trilha
// de auditoria. Atualiza sozinho enquanto a aba está aberta.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { admin } from "@/lib/api/endpoints";
import { BarList, ChartTitle } from "@/components/charts";
import { Badge, Card, Chip, EmptyState, PageHead, Section, Segmented } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { IconCheck, IconClock, IconFlame, IconServer } from "@/components/ui/icons";
import { num } from "@/lib/utils";
import type { AuditEntry } from "@/lib/api/types";

const fmtTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

const uptime = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const AUDIT_FILTERS = [
  { v: "", label: "Tudo" }, { v: "auth.", label: "Autenticação" },
  { v: "user.", label: "Usuários" }, { v: "course.", label: "Cursos" },
  { v: "period.", label: "Períodos" }, { v: "announcement.", label: "Avisos" },
] as const;

export default function AdminMonitorPage() {
  const [filter, setFilter] = useState<(typeof AUDIT_FILTERS)[number]["v"]>("");

  const { data: m, isLoading } = useQuery({
    queryKey: ["metrics"], queryFn: admin.metrics, refetchInterval: 10_000,
  });
  const { data: audit } = useQuery({
    queryKey: ["audit", filter],
    queryFn: () => admin.audit({ limit: 40, ...(filter ? { action: filter } : {}) }),
    refetchInterval: 20_000,
  });

  const errRate = m && m.http.total > 0 ? Math.round((m.http.status.s5xx / m.http.total) * 1000) / 10 : 0;

  const auditCols: Column<AuditEntry>[] = [
    { header: "Quando", cell: (a) => <span className="text-muted-foreground font-mono text-xs">{fmtTime.format(new Date(a.createdAt))}</span> },
    { header: "Ação", cell: (a) => <Badge>{a.action}</Badge> },
    { header: "Quem", cell: (a) => <span className="text-muted-foreground">{a.user?.name ?? a.userId ?? "—"}</span> },
    { header: "Alvo", cell: (a) => <span className="text-muted-foreground font-mono text-xs">{a.entity ? `${a.entity}${a.entityId ? `:${a.entityId.slice(0, 8)}` : ""}` : "—"}</span> },
    { header: "IP", align: "right", cell: (a) => <span className="text-subtle-foreground font-mono text-xs">{a.ip ?? "—"}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="administração · observabilidade" title="Monitor" />

      {isLoading || !m ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <ChartTitle icon={IconCheck} title="Banco de dados" />
              <p className={`font-display mt-3 text-3xl font-semibold tracking-tight ${m.db.ok ? "text-savanna" : "text-lock"}`}>
                {m.db.ok ? "OK" : "FALHA"}
              </p>
              <p className="text-subtle-foreground mt-1 text-xs">ping {m.db.pingMs} ms</p>
            </Card>
            <Card>
              <ChartTitle icon={IconClock} title="Latência p95" />
              <p className="font-display mt-3 text-3xl font-semibold tracking-tight">
                {m.http.latencyMs.p95 ?? "—"}<span className="text-muted-foreground text-base"> ms</span>
              </p>
              <p className="text-subtle-foreground mt-1 text-xs">
                p50 {m.http.latencyMs.p50 ?? "—"} · p99 {m.http.latencyMs.p99 ?? "—"}
              </p>
            </Card>
            <Card>
              <ChartTitle icon={IconFlame} title="Erros 5xx" />
              <p className={`font-display mt-3 text-3xl font-semibold tracking-tight ${errRate > 1 ? "text-lock" : ""}`}>
                {errRate}<span className="text-muted-foreground text-base">%</span>
              </p>
              <p className="text-subtle-foreground mt-1 text-xs">
                {num(m.http.status.s5xx)} de {num(m.http.total)} requisições
              </p>
            </Card>
            <Card>
              <ChartTitle icon={IconServer} title="Processo" />
              <p className="font-display mt-3 text-3xl font-semibold tracking-tight">{uptime(m.uptimeSec)}</p>
              <p className="text-subtle-foreground mt-1 text-xs">
                node {m.process.node} · RSS {m.process.rssMb} MB · heap {m.process.heapUsedMb} MB
              </p>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Rotas mais usadas">
              {m.http.topRoutes.length === 0 ? <EmptyState>Sem tráfego registrado ainda.</EmptyState> : (
                <BarList data={m.http.topRoutes.map((r) => ({
                  label: r.route, value: r.count, hint: `${r.avgMs} ms em média`,
                }))} />
              )}
            </Section>
            <Section title="Rotas mais lentas">
              {m.http.slowestRoutes.length === 0 ? <EmptyState>Sem tráfego registrado ainda.</EmptyState> : (
                <BarList color="var(--color-ember)" unit=" ms"
                  data={m.http.slowestRoutes.map((r) => ({
                    label: r.route, value: r.maxMs, hint: `${r.count} chamada(s)`,
                  }))} />
              )}
            </Section>
          </div>

          <div className="grid gap-5 sm:grid-cols-4">
            {([["2xx", m.http.status.s2xx, "done"], ["3xx", m.http.status.s3xx, "co"],
               ["4xx", m.http.status.s4xx, "avail"], ["5xx", m.http.status.s5xx, "lock"]] as const).map(([k, v, tone]) => (
              <Card key={k} className="flex items-center justify-between">
                <Chip tone={tone}>{k}</Chip>
                <span className="font-display text-2xl font-semibold tracking-tight">{num(v)}</span>
              </Card>
            ))}
          </div>
        </>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="section-label !mb-0">Trilha de auditoria</h3>
          <Segmented label="Filtrar auditoria" value={filter} onChange={setFilter} options={[...AUDIT_FILTERS]} />
        </div>
        <DataTable rows={audit?.entries ?? []} columns={auditCols} keyOf={(a) => a.id}
          empty={<EmptyState>Nenhum registro com esse filtro.</EmptyState>} />
      </Card>
    </div>
  );
}
