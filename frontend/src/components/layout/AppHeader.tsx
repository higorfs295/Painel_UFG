// Cabeçalho: marca, abas, seletor de curso (se >1 enrollment), tema, usuário e logout.
import { useQuery } from "@tanstack/react-query";
import NavTabs from "./NavTabs";
import ThemeToggle from "./ThemeToggle";
import Button from "../ui/Button";
import { useAuth } from "../../store/auth";
import { me } from "../../api/endpoints";
import type { Enrollment } from "../../api/types";

type Props = {
  enrollments: Enrollment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLogout: () => void;
};

export default function AppHeader({ enrollments, selectedId, onSelect, onLogout }: Props) {
  const user = useAuth((s) => s.user);
  // RF-20: período corrente — o valor persistido na matrícula vence; a heurística do servidor
  // (GET /me, cacheado) preenche a lacuna e sinaliza férias.
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: me.profile, staleTime: 5 * 60_000 });
  const enr = enrollments.find((e) => e.id === selectedId);
  const period = profile?.period ?? user?.period;
  const termLabel = enr?.currentTerm ?? period?.label ?? null;
  const onBreak = period?.onBreak && !enr?.currentTerm;
  return (
    <header className="header">
      <div className="container">
        <span className="brand"><span className="dot" />Painel Acadêmico</span>
        {termLabel && (
          <span className={`chip ${onBreak ? "sim" : "avail"}`} title={onBreak ? `Próximo período: ${period?.nextTerm}` : "Período letivo corrente (edite em Ajustes)"}>
            <span className="swatch" />{onBreak ? "🌴 Férias" : termLabel}
          </span>
        )}
        <NavTabs />
        <div className="row" style={{ gap: 10 }}>
          {enrollments.length > 1 && (
            <select value={selectedId ?? ""} onChange={(e) => onSelect(e.target.value)}
              title="Curso" aria-label="Selecionar curso">
              {enrollments.map((e) => (
                <option key={e.id} value={e.id}>{e.course.name}</option>
              ))}
            </select>
          )}
          <ThemeToggle />
          <span className="mut hide-sm" title={user?.email}>{user?.name}</span>
          <Button variant="ghost" size="sm" onClick={onLogout}>Sair</Button>
        </div>
      </div>
    </header>
  );
}
