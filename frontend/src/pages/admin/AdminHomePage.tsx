// Admin · Visão do sistema (RF-21): números da instância (com contadores animados), crescimento,
// distribuição por curso e estado do calendário, com atalhos. O admin não cursa — administra.
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { admin } from "../../api/endpoints";
import Reveal from "../../components/ui/Reveal";
import CountNum from "../../components/ui/CountNum";
import { IconUsers, IconBook, IconFlame, IconSprout, IconGrid, IconServer } from "../../components/ui/Icons";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export default function AdminHomePage() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: admin.stats });
  const periods = useQuery({ queryKey: ["admin-periods"], queryFn: admin.periods });
  const s = stats.data;
  const cur = periods.data?.current;
  const maxCourse = Math.max(1, ...(s?.byCourse.map((c) => c.count) ?? [1]));

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">administração</span>
        <h1>Visão do <em>sistema</em></h1>
      </header>

      <div className="bento">
        <div className="b-cell sp3 stat-cell tint-copper">
          <span className="stat-ico"><IconUsers /></span>
          <span className="stat-num">{s ? <CountNum value={s.users.total} /> : "…"}</span>
          <span className="stat-lbl">usuários</span>
          <span className="stat-sub">{s ? `${s.users.admins} admin(s) · ${s.users.pendingInvites} convite(s) pendente(s)` : ""}</span>
        </div>
        <div className="b-cell sp3 stat-cell tint-savanna">
          <span className="stat-ico"><IconSprout /></span>
          <span className="stat-num">{s ? <><span className="plus">+</span><CountNum value={s.users.newUsers30d} /></> : "…"}</span>
          <span className="stat-lbl">novos (30 dias)</span>
          <span className="stat-sub">crescimento recente de contas</span>
        </div>
        <div className="b-cell sp3 stat-cell tint-jenipapo">
          <span className="stat-ico"><IconBook /></span>
          <span className="stat-num">{s ? <CountNum value={s.courses} /> : "…"}</span>
          <span className="stat-lbl">cursos</span>
          <span className="stat-sub">{s ? `${s.enrollments} matrícula(s)` : ""}</span>
        </div>
        <div className="b-cell sp3 stat-cell tint-dusk">
          <span className="stat-ico"><IconFlame /></span>
          <span className="stat-num">{s ? <CountNum value={s.activity.subjectStatuses} /> : "…"}</span>
          <span className="stat-lbl">disciplinas marcadas</span>
          <span className="stat-sub">{s ? `${s.activity.extras} extras · ${s.activity.scenarios} cenários` : ""}</span>
        </div>
      </div>

      <div className="bento">
        <Reveal className="sp7">
          <section className="b-cell" style={{ height: "100%" }}>
            <span className="ghostnum" aria-hidden="true">01</span>
            <h3>Matrículas por curso</h3>
            {!s?.byCourse.length ? <p className="mut">Nenhuma matrícula ainda.</p> : (
              <div className="stack" style={{ gap: 12 }}>
                {s.byCourse.map((c) => (
                  <div key={c.slug}>
                    <div className="meta">
                      <span title={c.name}>{c.slug}</span>
                      <span>{c.count}</span>
                    </div>
                    <div className="bar"><span style={{ width: `${(c.count / maxCourse) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>

        <Reveal className="sp5" delay={90}>
          <div className="callout" style={{ height: "100%" }}>
            <div className="callout-body">
              <span className="eyebrow">período vigente · global</span>
              <strong className="callout-big">{cur ? (cur.onBreak ? "🌴 Férias" : cur.label) : "…"}</strong>
              <span className="mut">
                {cur ? (cur.nextStartsAt
                  ? <>próxima virada em {fmt.format(new Date(cur.nextStartsAt))} → <b>{cur.nextTerm}</b></>
                  : <>depois vem: <b>{cur.nextTerm}</b></>) : ""}
                {cur?.source === "heuristic" && <> · (sem calendário — sugestão automática)</>}
              </span>
              <Link to="/admin/periodos" className="btn ghost sm" style={{ marginTop: 10, alignSelf: "flex-start" }}>
                Gerir calendário →
              </Link>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="linkgrid">
        <Link to="/admin/usuarios" className="linkcard">
          <span className="linkcard-ico"><IconUsers /></span>
          <strong>Usuários</strong>
          <span className="mut">contas, convites, papéis e matrículas</span>
          <span className="linkcard-go" aria-hidden="true">→</span>
        </Link>
        <Link to="/admin/cursos" className="linkcard">
          <span className="linkcard-ico"><IconBook /></span>
          <strong>Cursos</strong>
          <span className="mut">catálogo de matrizes e importação</span>
          <span className="linkcard-go" aria-hidden="true">→</span>
        </Link>
        <Link to="/admin/periodos" className="linkcard">
          <span className="linkcard-ico"><IconGrid /></span>
          <strong>Períodos</strong>
          <span className="mut">calendário acadêmico global e agendado</span>
          <span className="linkcard-go" aria-hidden="true">→</span>
        </Link>
        <Link to="/admin/config" className="linkcard">
          <span className="linkcard-ico"><IconServer /></span>
          <strong>Configurações</strong>
          <span className="mut">e-mail (SMTP), cadastro e instância</span>
          <span className="linkcard-go" aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
