// Admin · Visão do sistema (RF-21): números da instância + estado do calendário,
// com atalhos para as áreas de gestão. O admin não cursa — ele administra.
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { admin } from "../../api/endpoints";
import { IconUsers, IconBook, IconClock, IconFlame } from "../../components/ui/Icons";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export default function AdminHomePage() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: admin.stats });
  const periods = useQuery({ queryKey: ["admin-periods"], queryFn: admin.periods });
  const s = stats.data;
  const cur = periods.data?.current;

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">Administração</span>
        <h1>Visão do sistema</h1>
      </header>

      <div className="statgrid">
        <div className="stat-card">
          <span className="stat-ico"><IconUsers /></span>
          <span className="stat-num">{s?.users.total ?? "…"}</span>
          <span className="stat-lbl">usuários</span>
          <span className="stat-sub">{s ? `${s.users.admins} admin(s) · ${s.users.pendingInvites} convite(s) pendente(s)` : ""}</span>
        </div>
        <div className="stat-card">
          <span className="stat-ico"><IconBook /></span>
          <span className="stat-num">{s?.courses ?? "…"}</span>
          <span className="stat-lbl">cursos</span>
          <span className="stat-sub">{s ? `${s.enrollments} matrícula(s)` : ""}</span>
        </div>
        <div className="stat-card">
          <span className="stat-ico"><IconClock /></span>
          <span className="stat-num">{cur ? (cur.onBreak ? "Férias" : cur.label) : "…"}</span>
          <span className="stat-lbl">período vigente</span>
          <span className="stat-sub">
            {cur ? (cur.nextStartsAt
              ? `próxima virada: ${fmt.format(new Date(cur.nextStartsAt))} → ${cur.nextTerm}`
              : `depois: ${cur.nextTerm}`) : ""}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-ico"><IconFlame /></span>
          <span className="stat-num">{s?.activity.subjectStatuses ?? "…"}</span>
          <span className="stat-lbl">disciplinas marcadas</span>
          <span className="stat-sub">{s ? `${s.activity.extras} extras · ${s.activity.scenarios} cenários` : ""}</span>
        </div>
      </div>

      <div className="linkgrid">
        <Link to="/admin/usuarios" className="linkcard">
          <strong>Usuários</strong>
          <span className="mut">contas, convites, papéis e matrículas</span>
          <span className="linkcard-go" aria-hidden="true">→</span>
        </Link>
        <Link to="/admin/cursos" className="linkcard">
          <strong>Cursos</strong>
          <span className="mut">catálogo de matrizes e importação</span>
          <span className="linkcard-go" aria-hidden="true">→</span>
        </Link>
        <Link to="/admin/periodos" className="linkcard">
          <strong>Períodos</strong>
          <span className="mut">calendário acadêmico global e agendado</span>
          <span className="linkcard-go" aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
