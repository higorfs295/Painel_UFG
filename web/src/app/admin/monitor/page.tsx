"use client";

// Admin · Monitor (RF-27, v12): saúde e tráfego da API AO VIVO — requisições por minuto na
// última hora, faixa de estado por minuto, latências, distribuição de status e rotas. Atualiza
// sozinho a cada 10 s enquanto a aba está aberta. A trilha de auditoria mudou para a tela
// Auditoria.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RiDatabase2Line, RiPulseLine, RiRouteLine, RiServerLine, RiSpeedUpLine, RiTimerFlashLine, RiErrorWarningLine } from "@remixicon/react";
import { admin } from "@/lib/api/endpoints";
import { PageBanner } from "@/components/fx/page-banner";
import { StatTile } from "@/components/fx/art";
import { Tracker, type TrackerBlock } from "@/components/fx/tracker";
import { Donut, DonutLegend } from "@/components/fx/donut";
import { Panel, Pill } from "@/components/admin/panel";
import { AreaChart } from "@/components/tremor/AreaChart";
import { BarList } from "@/components/tremor/BarList";
import { cx, num } from "@/lib/utils";

const hm = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const uptime = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}min` : `${m}min`;
};

export default function AdminMonitorPage() {
  const { data: m, isLoading, dataUpdatedAt } = useQuery({ queryKey: ["metrics"], queryFn: admin.metrics, refetchInterval: 10_000 });

  const tl = m?.http.timeline ?? [];
  const blocks: TrackerBlock[] = tl.map((p) => ({
    key: p.at,
    tone: p.count === 0 ? "idle" : p.errors5xx > 0 ? "error" : p.errors4xx > 0 ? "warn" : "ok",
    title: `${hm.format(new Date(p.at))} — ${p.count} req${p.errors5xx ? `, ${p.errors5xx} erro(s) 5xx` : ""}${p.errors4xx ? `, ${p.errors4xx} 4xx` : ""}${p.count ? `, média ${p.avgMs} ms` : ""}`,
  }));
  const lastHour = tl.reduce((s, p) => s + p.count, 0);
  const errRate = m && m.http.total > 0 ? (m.http.status.s5xx / m.http.total) * 100 : 0;
  const status = m ? [
    { label: "2xx sucesso", value: m.http.status.s2xx, tone: "emerald" },
    { label: "3xx redirecionamento", value: m.http.status.s3xx, tone: "blue" },
    { label: "4xx erro do cliente", value: m.http.status.s4xx, tone: "amber" },
    { label: "5xx erro do servidor", value: m.http.status.s5xx, tone: "red" },
  ] : [];

  return (
    <div className="flex flex-col gap-6">
      <PageBanner eyebrow="Operação" icon={RiPulseLine} title="Monitor" tone="emerald"
        description={<>Saúde e tráfego da API em tempo real, desde que o processo subiu. Quem fez o quê fica na <Link href="/admin/auditoria" className="font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-400">Auditoria</Link>.</>}
        aside={
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-white/70 px-4 py-3 dark:border-emerald-500/30 dark:bg-gray-950/60">
            <span className="live-dot text-emerald-500" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-gray-900 dark:text-gray-50">Ao vivo</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{dataUpdatedAt ? `atualizado ${hm.format(new Date(dataUpdatedAt))}` : "conectando…"} · a cada 10 s</p>
            </div>
          </div>
        }
      />

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !m ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />) : (<>
          <StatTile label="Banco de dados" value={m.db.pingMs} decimals={1} suffix=" ms" icon={RiDatabase2Line} tone={m.db.ok ? "emerald" : "red"} hint={m.db.ok ? "respondendo (ping)" : "FALHA ao consultar"} />
          <StatTile label="Latência p95" value={m.http.latencyMs.p95 ?? 0} decimals={1} suffix=" ms" icon={RiTimerFlashLine} tone="blue"
            hint={`p50 ${m.http.latencyMs.p50 ?? "—"} · p99 ${m.http.latencyMs.p99 ?? "—"} ms`} trend={tl.map((p) => p.avgMs)} />
          <StatTile label="Requisições na última hora" value={lastHour} icon={RiSpeedUpLine} tone="brand" hint={`${num(m.http.total)} desde que subiu`} trend={tl.map((p) => p.count)} />
          <StatTile label="Erros 5xx" value={errRate} decimals={1} suffix="%" icon={RiErrorWarningLine} tone={errRate > 1 ? "red" : "gray"} hint={`${num(m.http.status.s5xx)} de ${num(m.http.total)}`} />
        </>)}
      </div>

      <Panel icon={RiPulseLine} tone="emerald" id="ultima-hora" title="Última hora" description="um bloco por minuto: verde sem erro, âmbar com 4xx, vermelho com 5xx, cinza sem tráfego"
        action={m && <Pill tone="gray">processo há {uptime(m.uptimeSec)}</Pill>}>
        {!m ? <div className="skeleton h-48" /> : (<>
          <Tracker data={blocks} label="Estado por minuto na última hora" />
          <div className="mt-1.5 flex justify-between text-[0.65rem] text-gray-500 dark:text-gray-400" aria-hidden="true">
            <span>{tl[0] ? hm.format(new Date(tl[0].at)) : ""}</span><span>agora</span>
          </div>
          <AreaChart className="mt-6 h-52" data={tl.map((p) => ({ minuto: hm.format(new Date(p.at)), Requisições: p.count, "Erros 5xx": p.errors5xx }))}
            index="minuto" categories={["Requisições", "Erros 5xx"]} colors={["brand", "red"]} allowDecimals={false} yAxisWidth={30}
            startEndOnly fill="gradient" />
        </>)}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel icon={RiServerLine} tone="violet" id="status" title="Respostas por status" description="desde que o processo subiu">
          {!m ? <div className="skeleton h-48" /> : (
            <div className="flex flex-col items-center gap-5">
              <Donut data={status} label="Respostas por classe de status" size={132}>
                <div><span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50">{num(m.http.total)}</span><p className="text-xs text-gray-500">respostas</p></div>
              </Donut>
              <div className="w-full"><DonutLegend data={status} /></div>
            </div>
          )}
        </Panel>
        <Panel icon={RiRouteLine} tone="brand" id="rotas" title="Rotas mais usadas">
          {!m || m.http.topRoutes.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">Sem tráfego registrado ainda.</p> : (
            <BarList data={m.http.topRoutes.map((r) => ({ name: r.route, value: r.count }))} valueFormatter={(v) => `${num(v)}×`} />
          )}
        </Panel>
        <Panel icon={RiTimerFlashLine} tone="amber" id="lentas" title="Rotas mais lentas" description="média por chamada">
          {!m || m.http.slowestRoutes.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">Sem tráfego registrado ainda.</p> : (
            <ul className="flex flex-col gap-2.5">
              {m.http.slowestRoutes.map((r) => (
                <li key={r.route} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <code className="truncate text-xs">{r.route}</code>
                    <span className={cx("shrink-0 text-xs font-medium tabular-nums", r.avgMs > 500 ? "text-red-700 dark:text-red-400" : r.avgMs > 150 ? "text-amber-700 dark:text-amber-400" : "text-gray-700 dark:text-gray-300")}>{r.avgMs} ms</span>
                  </div>
                  <p className="text-[0.65rem] text-gray-500 dark:text-gray-400">{r.count} chamada(s) · pico {r.maxMs} ms</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {m && <p className="text-xs text-gray-500 dark:text-gray-400">Node {m.process.node} · memória RSS {m.process.rssMb} MB · heap {m.process.heapUsedMb} MB. As métricas vivem na memória do processo: um reinício zera os contadores.</p>}
    </div>
  );
}
