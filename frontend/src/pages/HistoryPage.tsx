// RF-22/23 — Histórico acadêmico: média global (MGA), ritmo/estimativa de formatura,
// desempenho por período e o histórico escolar completo. Conquistas em cartões lúdicos.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { me } from "../api/endpoints";
import { useApp } from "../store/app";
import Card from "../components/ui/Card";
import CountNum from "../components/ui/CountNum";
import Reveal from "../components/ui/Reveal";
import ExportButton from "../components/ui/ExportButton";
import { IconStar, IconClock, IconTarget } from "../components/ui/Icons";
import { ptNum } from "../lib/csv";
import type { TermSummary } from "../api/types";

const fmtH = (n: number) => n.toLocaleString("pt-BR");

// barra do período proporcional ao maior período do histórico
function TermBar({ t, max }: { t: TermSummary; max: number }) {
  return (
    <div>
      <div className="meta">
        <span><b>{t.term}</b> · {t.count} disciplina(s)</span>
        <span>{fmtH(t.hours)}h {t.avg != null && <span className="over">média {t.avg.toFixed(2)}</span>}</span>
      </div>
      <div className="bar"><span style={{ width: `${max > 0 ? (t.hours / max) * 100 : 0}%` }} /></div>
    </div>
  );
}

export default function HistoryPage() {
  const enrollmentId = useApp((s) => s.enrollmentId)!;
  const [termFilter, setTermFilter] = useState("");   // "" = todos os períodos
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["history", enrollmentId], queryFn: () => me.history(enrollmentId), enabled: !!enrollmentId,
  });
  const { data: ach } = useQuery({
    queryKey: ["achievements", enrollmentId], queryFn: () => me.achievements(enrollmentId), enabled: !!enrollmentId,
  });

  // o filtro vale para a tabela E para a exportação — o CSV sai igual ao que está na tela
  const records = useMemo(
    () => (data?.records ?? []).filter((r) => !termFilter || r.term === termFilter),
    [data, termFilter]);

  if (isError) return (
    <div className="muted-box" role="alert">
      Não foi possível carregar o histórico.{" "}
      <button className="btn sm" onClick={() => refetch()}>Tentar novamente</button>
    </div>
  );
  if (isLoading || !data) return <div className="spinner" role="status" aria-live="polite">Carregando histórico…</div>;

  const maxHours = Math.max(1, ...data.terms.map((t) => t.hours));

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">desempenho</span>
        <h1>Histórico <em>acadêmico</em></h1>
      </header>

      <div className="bento">
        <div className="b-cell sp4 stat-cell tint-copper">
          <span className="stat-ico"><IconStar /></span>
          <span className="stat-num">{data.mga != null ? data.mga.toFixed(2) : "—"}</span>
          <span className="stat-lbl">média global (MGA)</span>
          <span className="stat-sub">ponderada pela carga horária</span>
        </div>
        <div className="b-cell sp4 stat-cell tint-jenipapo">
          <span className="stat-ico"><IconClock /></span>
          <span className="stat-num">
            {data.pace.avgHoursPerTerm != null ? <CountNum value={data.pace.avgHoursPerTerm} /> : "—"}
            <small> h</small>
          </span>
          <span className="stat-lbl">ritmo por período</span>
          <span className="stat-sub">média dos últimos períodos</span>
        </div>
        <div className="b-cell sp4 stat-cell tint-savanna">
          <span className="stat-ico"><IconTarget /></span>
          <span className="stat-num">
            {data.pace.estTermsLeft != null ? <CountNum value={data.pace.estTermsLeft} /> : "—"}
          </span>
          <span className="stat-lbl">períodos restantes (est.)</span>
          <span className="stat-sub">faltam {fmtH(data.totals.remaining)}h</span>
        </div>
      </div>

      {ach && (
        <Reveal>
          <Card>
            <h3>Conquistas <span className="mut" style={{ fontWeight: 400 }}>— {ach.earned} de {ach.total}</span></h3>
            <div className="row wrap" style={{ gap: 10 }}>
              {ach.achievements.map((a) => (
                <span key={a.key} className={`sticker${a.earned ? " done" : ""}`}
                  title={a.desc} style={a.earned ? undefined : { opacity: .45 }}>
                  <span aria-hidden="true">{a.icon}</span> {a.label}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>
      )}

      <Reveal>
        <Card>
          <h3>Desempenho por período</h3>
          {data.terms.length === 0 ? (
            <div className="muted-box">
              Nenhum período registrado ainda. Ao marcar uma disciplina como aprovada, informe o
              período (ex.: 2024.1) e a nota para montar seu histórico.
            </div>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              {data.terms.map((t) => <TermBar key={t.term} t={t} max={maxHours} />)}
              {data.noTerm.count > 0 && (
                <p className="mut" style={{ fontSize: ".82rem", margin: 0 }}>
                  + {data.noTerm.count} disciplina(s) sem período informado ({fmtH(data.noTerm.hours)}h).
                </p>
              )}
            </div>
          )}
        </Card>
      </Reveal>

      <Reveal>
        <Card tight>
          <div className="row wrap spread" style={{ padding: "6px 8px 0" }}>
            <h3 style={{ margin: 0 }}>Histórico escolar</h3>
            <div className="row wrap" style={{ gap: 8 }}>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <span>Período</span>
                <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} aria-label="Filtrar por período">
                  <option value="">todos</option>
                  {data.terms.map((t) => <option key={t.term} value={t.term}>{t.term}</option>)}
                </select>
              </label>
              <ExportButton name="historico" rows={records} columns={[
                { header: "Período", value: (r) => r.term ?? "" },
                { header: "Código", value: (r) => r.code },
                { header: "Disciplina", value: (r) => r.name },
                { header: "CH", value: (r) => r.hours },
                { header: "Nota", value: (r) => ptNum(r.grade) },
                { header: "Faltas", value: (r) => r.absences ?? "" },
                { header: "Situação", value: (r) => (r.state === "APPROVED" ? "Aprovada" : "Cursando") },
              ]} />
            </div>
          </div>
          {records.length === 0 ? (
            <p className="mut" style={{ padding: "8px 8px 10px" }}>
              {termFilter ? `Nada registrado em ${termFilter}.` : "Nada registrado ainda."}
            </p>
          ) : (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Período</th><th>Código</th><th>Disciplina</th><th>CH</th><th>Nota</th><th>Faltas</th><th>Situação</th></tr></thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.seq}>
                      <td className="mut">{r.term ?? "—"}</td>
                      <td className="mut">{r.code}</td>
                      <td>{r.name}</td>
                      <td>{r.hours}h</td>
                      <td>{r.grade != null ? <b>{r.grade.toFixed(1)}</b> : "—"}</td>
                      <td className="mut">{r.absences ?? "—"}</td>
                      <td>
                        <span className={`chip ${r.state === "APPROVED" ? "done" : "cursando"}`}>
                          <span className="swatch" />{r.state === "APPROVED" ? "Aprovada" : "Cursando"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
