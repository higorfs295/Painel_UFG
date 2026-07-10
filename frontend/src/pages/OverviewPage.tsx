// Visão geral: hero de estatísticas, ticker de recomendações, donut, composições, marcos e ranking.
import { useQuery } from "@tanstack/react-query";
import type { ComponentType, SVGProps } from "react";
import { me } from "../api/endpoints";
import { useApp } from "../store/app";
import Card from "../components/ui/Card";
import { IconClock, IconTarget, IconCheck, IconFlame } from "../components/ui/Icons";
import type { Composition, Recommendation } from "../api/types";

// cartão de estatística com número grande em display (estilo dashboards de referência)
function Stat({ icon: Icon, num, unit, label }: {
  icon: ComponentType<SVGProps<SVGSVGElement>>; num: string | number; unit?: string; label: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-ico"><Icon /></div>
      <div className="stat-num">{num}{unit && <small> {unit}</small>}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  );
}

// marquee vivo com as recomendações (pausa no hover; some em reduced-motion)
function Ticker({ recs }: { recs: Recommendation[] }) {
  if (!recs.length) return null;
  const items = recs.map((r) => (
    <span key={r.seq} className="ticker-item">
      <b>{r.name}</b> <span className="up">↗ destrava {r.tot}</span> <span className="ticker-sep">◆</span>
    </span>
  ));
  return (
    <div className="ticker" aria-hidden="true">
      <span className="ticker-tag">Próximos passos</span>
      <div className="ticker-view">
        <div className="ticker-track">{items}{items.map((el, i) => <span key={`d${i}`}>{el}</span>)}</div>
      </div>
    </div>
  );
}

function Donut({ pct, label }: { pct: number; label: string }) {
  const r = 52, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, pct) / 100);
  return (
    <div className="donut">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--panel2)" strokeWidth="14" />
        <circle className="donut-ring" cx="70" cy="70" r={r} fill="none" stroke="var(--copper)" strokeWidth="14"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ ["--circ" as string]: String(c) } as React.CSSProperties}
          transform="rotate(-90 70 70)" />
        <text x="70" y="66" textAnchor="middle" className="val" fill="var(--tx)" fontSize="26" fontWeight="750">
          {Math.round(pct)}%
        </text>
        <text x="70" y="88" textAnchor="middle" fill="var(--mut)" fontSize="11">{label}</text>
      </svg>
    </div>
  );
}

function CompBar({ c }: { c: Composition }) {
  return (
    <div>
      <div className="meta">
        <span>{c.label}</span>
        <span>{c.hours}/{c.required}h {c.over > 0 && <span className="over">(+{c.over}h)</span>}</span>
      </div>
      <div className="bar"><span style={{ width: `${c.pct}%` }} /></div>
    </div>
  );
}

export default function OverviewPage() {
  const enrollmentId = useApp((s) => s.enrollmentId);
  const { data: prog, isLoading, isError, refetch } = useQuery({
    queryKey: ["progress", enrollmentId], queryFn: () => me.progress(enrollmentId!), enabled: !!enrollmentId,
  });
  const { data: recs } = useQuery({
    queryKey: ["recs", enrollmentId], queryFn: () => me.recommendations(enrollmentId!, 8), enabled: !!enrollmentId,
  });

  if (isError) return (
    <div className="muted-box" role="alert">
      Não foi possível carregar o progresso.{" "}
      <button className="btn sm" onClick={() => refetch()}>Tentar novamente</button>
    </div>
  );
  if (isLoading || !prog) return <div className="spinner" role="status" aria-live="polite">Carregando progresso…</div>;

  const doneCount = prog.subjects.filter((s) => s.status === "done").length;
  const availCount = prog.subjects.filter((s) => s.status === "avail").length;
  const nextMilestone = prog.milestones.find((m) => !m.reached);

  return (
    <div className="stack">
      <div className="row spread wrap">
        <div>
          <h1>Visão <em>geral</em></h1>
          <p className="mut">
            {prog.totals.hours}h de {prog.totals.required}h integralizadas · {doneCount} disciplinas concluídas
          </p>
        </div>
      </div>
      <div className="tribal" aria-hidden="true" />

      <div className="statgrid">
        <Stat icon={IconClock} num={prog.totals.hours.toLocaleString("pt-BR")} unit="h" label="Integralizadas" />
        <Stat icon={IconCheck} num={doneCount} label="Concluídas" />
        <Stat icon={IconTarget} num={availCount} label="Disponíveis agora" />
        <Stat icon={IconFlame}
          num={nextMilestone ? `${Math.max(0, nextMilestone.hours - prog.totals.hours).toLocaleString("pt-BR")}` : "—"}
          unit={nextMilestone ? "h" : undefined}
          label={nextMilestone ? `Até o marco ${nextMilestone.key}` : "Marcos concluídos"} />
      </div>

      {recs && <Ticker recs={recs} />}

      <div className="grid-2">
        <Card className="center">
          <Donut pct={prog.totals.pct} label="integralizado" />
        </Card>
        <Card>
          <h3>Composições curriculares</h3>
          <div className="stack" style={{ gap: 14 }}>
            {prog.compositions.map((c) => <CompBar key={c.key} c={c} />)}
          </div>
        </Card>
      </div>

      <Card>
        <h3>Marcos de horas</h3>
        <div className="row wrap" style={{ gap: 10 }}>
          {prog.milestones.length === 0 && <span className="mut">Este curso não define marcos de horas.</span>}
          {prog.milestones.map((m) => (
            <span key={m.key} className={`chip ${m.reached ? "done" : "lock"}`} title={m.description}>
              <span className="swatch" />{m.key} · {m.hours}h {m.reached ? "✓" : ""}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <h3>Recomendações <span className="mut" style={{ fontWeight: 400 }}>— disponíveis que mais destravam</span></h3>
        {!recs || recs.length === 0 ? (
          <div className="muted-box">Nenhuma disciplina disponível no momento.</div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Código</th><th>Disciplina</th><th>CH</th><th>Destrava (obrig.)</th></tr></thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.seq}>
                    <td className="mut">{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.hours}h</td>
                    <td><span className="badge">{r.tot} ({r.ob})</span></td>
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
