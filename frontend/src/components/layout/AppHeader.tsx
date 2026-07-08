// Cabeçalho: marca, abas, seletor de curso (se >1 enrollment), tema, usuário e logout.
import NavTabs from "./NavTabs";
import ThemeToggle from "./ThemeToggle";
import Button from "../ui/Button";
import { useAuth } from "../../store/auth";
import type { Enrollment } from "../../api/types";

type Props = {
  enrollments: Enrollment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLogout: () => void;
};

export default function AppHeader({ enrollments, selectedId, onSelect, onLogout }: Props) {
  const user = useAuth((s) => s.user);
  return (
    <header className="header">
      <div className="container">
        <span className="brand"><span className="dot" />Painel Acadêmico</span>
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
