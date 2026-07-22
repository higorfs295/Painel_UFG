// Visão geral v5 — mosaico bento: hero de integralização com número gigante, células de
// estatística, faixa marquee inclinada com as recomendações, composições com numeral
// fantasma, callout do próximo marco (borda cônica) e stickers de marcos.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ComponentType, SVGProps } from "react";
import { me, announcements } from "../api/endpoints";
import { useApp } from "../store/app";
import Card from "../components/ui/Card";
import Reveal from "../components/ui/Reveal";
import CountNum from "../components/ui/CountNum";
import { IconTarget, IconCheck, IconFlame } from "../components/ui/Icons";
import type { Composition, Recommendation } from "../api/types";

function StatCell({ icon: Icon, value, unit, label, tint }: {
  icon: ComponentType<SVGProps<SVGSVGElement>>; value: number | null; unit?: string; label: string; tint?: string;
}) {
  return (
    <section className={`b-cell sp4 stat-cell${tint ? " " + tint : ""}`}>
      <div className="stat-ico"><Icon /></div>
      <div className="stat-num">{value === null ? "—" : <CountNum value={value} />}{value !== null && unit && <small> {unit}</small>}</div>
      <div className="stat-lbl">{label}</div>
    </section>
  );
}

// faixa marquee inclinada com as recomendações (pausa no hover; para em reduced-motion)
function Strip({ recs }: { recs: Recommendation[] }) {
  if (!recs.length) return null;
  const items = recs.map((r) => (
    <span key={r.seq} className="strip-item">
      <b>{r.name}</b> <span className="up">destrava {r.tot}</span> <span className="strip-sep">◆</span>
    </span>
  ));
  return (
    <div className="strip" aria-hidden="true">
      <div className="strip-track">{items}{items.map((el, i) => <span key={`d${i}`}>{el}</span>)}</div>
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
  const { data: feed } = useQuery({ queryKey: ["announcements-feed"], queryFn: announcements.feed });

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
      <header className="page-head">
        <span className="eyebrow">sua jornada</span>
        <h1>Visão <em>geral</em></h1>
      </header>

      <div className="bento">
        <section className="b-cell sp7">
          <span className="ghostnum" aria-hidden="true">01</span>
          <span className="eyebrow">integralização</span>
          <div className="hero-pct"><CountNum value={prog.totals.pct} /><small>%</small></div>
          <p className="mut" style={{ margin: "0 0 12px" }}>
            {prog.totals.hours.toLocaleString("pt-BR")}h de {prog.totals.required.toLocaleString("pt-BR")}h
            {" "}integralizadas · {doneCount} disciplinas concluídas
          </p>
          <div className="bar"><span style={{ width: `${prog.totals.pct}%` }} /></div>
        </section>

        <section className="b-cell sp5 center" style={{ display: "grid", placeItems: "center" }}>
          <Donut pct={prog.totals.pct} label="integralizado" />
        </section>

        <StatCell icon={IconCheck} value={doneCount} label="Concluídas" tint="tint-savanna" />
        <StatCell icon={IconTarget} value={availCount} label="Disponíveis agora" tint="tint-jenipapo" />
        <StatCell icon={IconFlame}
          value={nextMilestone ? Math.max(0, nextMilestone.hours - prog.totals.hours) : null}
          unit="h" tint="tint-copper"
          label={nextMilestone ? `Até o marco ${nextMilestone.key}` : "Marcos concluídos"} />
      </div>

      {recs && <Strip recs={recs} />}

      {/* RF-24: comunicados da instância (fixados primeiro) */}
      {!!feed?.length && (
        <Card>
          <h3>Avisos</h3>
          <ul className="enr-list">
            {feed.slice(0, 3).map((a) => (
              <li key={a.id} style={{ display: "block" }}>
                <b>{a.pinned && "📌 "}{a.title}</b>
                <br /><span className="mut" style={{ fontSize: ".86rem" }}>{a.body}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="bento">
        <Reveal className="sp7">
          <section className="b-cell" style={{ height: "100%" }}>
            <span className="ghostnum" aria-hidden="true">02</span>
            <h3>Composições curriculares</h3>
            <div className="stack" style={{ gap: 14 }}>
              {prog.compositions.map((c) => <CompBar key={c.key} c={c} />)}
            </div>
          </section>
        </Reveal>

        <Reveal className="sp5" delay={90}>
          <div className="callout" style={{ height: "100%" }}>
            <div className="callout-body">
              <span className="eyebrow">próximo marco</span>
              {nextMilestone ? (
                <>
                  <strong className="callout-big">{nextMilestone.key} · {nextMilestone.hours.toLocaleString("pt-BR")}h</strong>
                  <span className="mut">
                    faltam <b>{Math.max(0, nextMilestone.hours - prog.totals.hours).toLocaleString("pt-BR")}h</b> — {nextMilestone.description}
                  </span>
                </>
              ) : (
                <>
                  <strong className="callout-big">Todos os marcos alcançados</strong>
                  <span className="mut">{prog.milestones.length === 0
                    ? "Este curso não define marcos de horas."
                    : "Agora é reta final até a integralização."}</span>
                </>
              )}
            </div>
          </div>
        </Reveal>

        {prog.milestones.length > 0 && (
          <Reveal className="sp12" delay={140}>
            <section className="b-cell">
              <span className="ghostnum" aria-hidden="true">03</span>
              <h3>Marcos de horas</h3>
              <div className="row wrap" style={{ gap: 12 }}>
                {prog.milestones.map((m) => (
                  <span key={m.key} className={`sticker${m.reached ? " done" : ""}`} title={m.description}>
                    {m.key} · {m.hours.toLocaleString("pt-BR")}h
                  </span>
                ))}
              </div>
            </section>
          </Reveal>
        )}
      </div>

      <Reveal>
        <Card>
          <div className="row spread wrap" style={{ alignItems: "baseline" }}>
            <h3>Recomendações <span className="mut" style={{ fontWeight: 400 }}>— disponíveis que mais destravam</span></h3>
            <Link to="/recomendacoes" className="btn ghost sm">Ver todas →</Link>
          </div>
          {!recs || recs.length === 0 ? (
            <div className="muted-box">Nenhuma disciplina disponível no momento.</div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Código</th><th>Disciplina</th><th>CH</th><th>Destrava (obrig.)</th></tr></thead>
                <tbody>
                  {recs.slice(0, 6).map((r) => (
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
      </Reveal>
    </div>
  );
}
