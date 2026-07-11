// Barra superior: hambúrguer (mobile), seletor de curso (aluno) e o chip do período
// letivo GLOBAL — resolvido no servidor pelo calendário acadêmico dos admins (RF-20 v2).
import { useQuery } from "@tanstack/react-query";
import ThemeToggle from "./ThemeToggle";
import { me } from "../../api/endpoints";
import { useAuth } from "../../store/auth";
import { IconMenu, IconX } from "../ui/Icons";
import type { Enrollment } from "../../api/types";

type Props = {
  enrollments: Enrollment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMenu: () => void;
  menuOpen: boolean;
};

export default function Topbar({ enrollments, selectedId, onSelect, onMenu, menuOpen }: Props) {
  const user = useAuth((s) => s.user);
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: me.profile, staleTime: 5 * 60_000 });
  const enr = enrollments.find((e) => e.id === selectedId);
  const period = profile?.period ?? user?.period;

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="hamburger" onClick={onMenu} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}>
          {menuOpen ? <IconX /> : <IconMenu />}
        </button>
        {enr && <span className="badge hide-sm" title={enr.course.name}>{enr.course.slug}</span>}
        {enrollments.length > 1 && (
          <select value={selectedId ?? ""} onChange={(e) => onSelect(e.target.value)}
            title="Curso" aria-label="Selecionar curso">
            {enrollments.map((e) => <option key={e.id} value={e.id}>{e.course.name}</option>)}
          </select>
        )}
      </div>
      <div className="topbar-right">
        {period && (
          <span className={`chip ${period.onBreak ? "sim" : "avail"}`}
            title={period.onBreak
              ? `Próximo período: ${period.nextTerm}`
              : `Período letivo corrente · depois: ${period.nextTerm}`}>
            <span className="swatch" />{period.onBreak ? "🌴 Férias" : period.label}
          </span>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
