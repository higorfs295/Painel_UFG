// Barra superior do conteúdo: hambúrguer (mobile), curso selecionado, chip do período
// letivo GLOBAL (resolvido no servidor pelo calendário dos admins, RF-20 v2), atalho da
// paleta de comandos e tema.
//
// É a "app bar" fina do idioma shadcn: fundo translúcido com blur, grudada no topo e
// separada do conteúdo por uma borda de 1px — nada de sombra pesada.
import { useQuery } from "@tanstack/react-query";
import ThemeToggle from "./ThemeToggle";
import { me } from "../../api/endpoints";
import { useAuth } from "../../store/auth";
import { openPalette } from "../CommandPalette";
import { IconMenu, IconX, IconCommand } from "../ui/Icons";
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
    <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <button onClick={onMenu} aria-expanded={menuOpen} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          className="icon-btn border-input rounded-lg border lg:hidden">
          {menuOpen ? <IconX /> : <IconMenu />}
        </button>

        {enr && <span className="badge hide-sm" title={enr.course.name}>{enr.course.slug}</span>}
        {enrollments.length > 1 && (
          <select value={selectedId ?? ""} onChange={(e) => onSelect(e.target.value)}
            title="Curso" aria-label="Selecionar curso" className="max-w-[220px] py-1.5 text-xs">
            {enrollments.map((e) => <option key={e.id} value={e.id}>{e.course.name}</option>)}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          {period && (
            <span className={`chip ${period.onBreak ? "sim" : "avail"}`}
              title={period.onBreak
                ? `Próximo período: ${period.nextTerm}`
                : `Período letivo corrente · depois: ${period.nextTerm}`}>
              <span className="swatch" />{period.onBreak ? "Férias" : period.label}
            </span>
          )}
          {/* a paleta escuta Ctrl/⌘+K globalmente; aqui é o caminho para quem usa mouse */}
          <button onClick={openPalette} title="Paleta de comandos (Ctrl+K)"
            className="border-input text-muted-foreground hover:text-foreground hover:bg-muted inline-flex
                       cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors">
            <IconCommand />
            <kbd className="hidden font-mono text-[0.65rem] sm:inline">Ctrl K</kbd>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
