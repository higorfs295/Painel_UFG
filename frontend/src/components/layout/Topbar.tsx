// Barra superior da área de conteúdo: seletor de curso, chip de período/férias e tema.
import { useQuery } from "@tanstack/react-query";
import ThemeToggle from "./ThemeToggle";
import { me } from "../../api/endpoints";
import { useAuth } from "../../store/auth";
import type { Enrollment } from "../../api/types";

type Props = {
  enrollments: Enrollment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function Topbar({ enrollments, selectedId, onSelect }: Props) {
  const user = useAuth((s) => s.user);
  // RF-20: período corrente — o persistido na matrícula vence; a heurística preenche a lacuna.
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: me.profile, staleTime: 5 * 60_000 });
  const enr = enrollments.find((e) => e.id === selectedId);
  const period = profile?.period ?? user?.period;
  const termLabel = enr?.currentTerm ?? period?.label ?? null;
  const onBreak = period?.onBreak && !enr?.currentTerm;

  return (
    <div className="topbar">
      <div className="topbar-left">
        {enr && <span className="badge hide-sm" title={enr.course.name}>{enr.course.slug}</span>}
        {enrollments.length > 1 && (
          <select value={selectedId ?? ""} onChange={(e) => onSelect(e.target.value)}
            title="Curso" aria-label="Selecionar curso">
            {enrollments.map((e) => <option key={e.id} value={e.id}>{e.course.name}</option>)}
          </select>
        )}
      </div>
      <div className="topbar-right">
        {termLabel && (
          <span className={`chip ${onBreak ? "sim" : "avail"}`}
            title={onBreak ? `Próximo período: ${period?.nextTerm}` : "Período letivo corrente (edite em Ajustes)"}>
            <span className="swatch" />{onBreak ? "🌴 Férias" : termLabel}
          </span>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
