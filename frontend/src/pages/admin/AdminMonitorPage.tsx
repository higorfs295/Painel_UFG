// RF-27 — Monitor: observabilidade da instância (saúde, latências, rotas, erros) e a trilha
// de auditoria. Atualiza sozinho a cada 10s enquanto a aba está aberta.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { admin } from "../../api/endpoints";
import Card from "../../components/ui/Card";
import CountNum from "../../components/ui/CountNum";
import Reveal from "../../components/ui/Reveal";
import { IconServer, IconClock, IconFlame, IconCheck } from "../../components/ui/Icons";

const fmtTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const uptime = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const AUDIT_FILTERS = [
  { v: "", label: "Tudo" }, { v: "auth.", label: "Autenticação" },
  { v: "user.", label: "Usuários" }, { v: "course.", label: "Cursos" },
  { v: "period.", label: "Períodos" }, { v: "announcement.", label: "Avisos" },
];

export default function AdminMonitorPage() {
  const [filter, setFilter] = useState("");
  const { data: m, isLoading } = useQuery({
    queryKey: ["metrics"], queryFn: admin.metrics, refetchInterval: 10_000,
  });
  const { data: audit } = useQuery({
    queryKey: ["audit", filter], queryFn: () => admin.audit({ limit: 40, ...(filter ? { action: filter } : {}) }),
    refetchInterval: 20_000,
  });

  const errRate = m && m.http.total > 0
    ? Math.round((m.http.status.s5xx / m.http.total) * 1000) / 10 : 0;

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">administração · observabilidade</span>
        <h1>Monitor</h1>
      </header>

      {isLoading || !m ? <div className="spinner" role="status">Carregando métricas…</div> : (
        <>
          <div className="bento">
            <div className="b-cell sp3 stat-cell tint-savanna">
              <span className="stat-ico"><IconCheck /></span>
              <span className="stat-num">{m.db.ok ? "OK" : "FALHA"}</span>
              <span className="stat-lbl">banco de dados</span>
              <span className="stat-sub">ping {m.db.pingMs} ms</span>
            </div>
            <div className="b-cell sp3 stat-cell tint-jenipapo">
              <span className="stat-ico"><IconClock /></span>
              <span className="stat-num">{m.http.latencyMs.p95 ?? "—"}<small> ms</small></span>
              <span className="stat-lbl">latência p95</span>
              <span className="stat-sub">p50 {m.http.latencyMs.p50 ?? "—"} · p99 {m.http.latencyMs.p99 ?? "—"}</span>
            </div>
            <div className="b-cell sp3 stat-cell tint-copper">
              <span className="stat-ico"><IconServer /></span>
              <span className="stat-num"><CountNum value={m.http.total} /></span>
              <span className="stat-lbl">requisições</span>
              <span className="stat-sub">no ar há {uptime(m.uptimeSec)}</span>
            </div>
            <div className="b-cell sp3 stat-cell tint-dusk">
              <span className="stat-ico"><IconFlame /></span>
              <span className="stat-num">{errRate}<small> %</small></span>
              <span className="stat-lbl">taxa de erro (5xx)</span>
              <span className="stat-sub">{m.http.status.s5xx} erro(s) · {m.http.status.s4xx} 4xx</span>
            </div>
          </div>

          <div className="bento">
            <Reveal className="sp6">
              <Card style={{ height: "100%" }}>
                <h3>Rotas mais usadas</h3>
                <div className="tablewrap">
                  <table>
                    <thead><tr><th>Rota</th><th>Reqs</th><th>Média</th></tr></thead>
                    <tbody>
                      {m.http.topRoutes.map((r) => (
                        <tr key={r.route}>
                          <td className="mut" style={{ fontSize: ".8rem" }}>{r.route}</td>
                          <td>{r.count}</td>
                          <td>{r.avgMs} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Reveal>
            <Reveal className="sp6" delay={90}>
              <Card style={{ height: "100%" }}>
                <h3>Rotas mais lentas</h3>
                <div className="tablewrap">
                  <table>
                    <thead><tr><th>Rota</th><th>Média</th><th>Máx</th></tr></thead>
                    <tbody>
                      {m.http.slowestRoutes.map((r) => (
                        <tr key={r.route}>
                          <td className="mut" style={{ fontSize: ".8rem" }}>{r.route}</td>
                          <td><b>{r.avgMs} ms</b></td>
                          <td className="mut">{r.maxMs} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Reveal>
          </div>

          <Card>
            <h3>Processo</h3>
            <div className="row wrap" style={{ gap: 10 }}>
              <span className="chip"><span className="swatch" />Node {m.process.node}</span>
              <span className="chip"><span className="swatch" />RSS {m.process.rssMb} MB</span>
              <span className="chip"><span className="swatch" />Heap {m.process.heapUsedMb} MB</span>
              <span className="chip avail"><span className="swatch" />2xx {m.http.status.s2xx}</span>
              <span className="chip sim"><span className="swatch" />3xx {m.http.status.s3xx}</span>
              <span className="chip lock"><span className="swatch" />4xx {m.http.status.s4xx}</span>
            </div>
          </Card>
        </>
      )}

      <Card tight>
        <div className="row wrap spread" style={{ padding: "6px 8px 0" }}>
          <h3 style={{ margin: 0 }}>Trilha de auditoria</h3>
          <div className="seg" role="tablist" aria-label="Filtrar auditoria">
            {AUDIT_FILTERS.map((f) => (
              <button key={f.v} type="button" role="tab" aria-selected={filter === f.v}
                className={"seg-btn" + (filter === f.v ? " on" : "")}
                onClick={() => setFilter(f.v)}>{f.label}</button>
            ))}
          </div>
        </div>
        {!audit ? <div className="spinner" role="status">Carregando…</div> :
          audit.entries.length === 0 ? <p className="mut" style={{ padding: "0 8px 10px" }}>Nenhum registro para este filtro.</p> : (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Quando</th><th>Ação</th><th>Quem</th><th>Alvo</th><th>IP</th></tr></thead>
                <tbody>
                  {audit.entries.map((e) => (
                    <tr key={e.id}>
                      <td className="mut">{fmtTime.format(new Date(e.createdAt))}</td>
                      <td><span className="badge">{e.action}</span></td>
                      <td>{e.user?.name ?? <span className="mut">—</span>}</td>
                      <td className="mut" style={{ fontSize: ".8rem" }}>
                        {e.entity ? `${e.entity}${e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}` : "—"}
                      </td>
                      <td className="mut">{e.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}
