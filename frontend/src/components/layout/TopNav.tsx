// Navegação v7 — trilho SUPERIOR, no lugar da barra lateral em gradiente das versões anteriores.
//
// A mudança é deliberada: a lateral empurrava todo o conteúdo para uma coluna estreita e
// dava ao app a silhueta genérica de "dashboard de template". Aqui a navegação é uma régua
// tipográfica horizontal — links em versalete, indicador de sublinhado, sem pílulas nem
// azulejos coloridos — e o conteúdo ocupa a largura toda da página.
import type { ComponentType, SVGProps } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../store/auth";
import { APP_NAME } from "../../branding";
import { openPalette } from "../CommandPalette";
import ThemeToggle from "./ThemeToggle";
import {
  IconSun, IconBook, IconSprout, IconGrid, IconSliders, IconShield, IconOut, IconUsers,
  IconCal, IconX, IconMenu, IconStar, IconServer, IconInfo, IconChart, IconCheckList,
  IconPulse, IconMegaphone, IconCommand,
} from "../ui/Icons";

type Item = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; end?: boolean };

const STUDENT: Item[] = [
  { to: "/", label: "Visão geral", icon: IconSun, end: true },
  { to: "/disciplinas", label: "Disciplinas", icon: IconBook },
  { to: "/extras", label: "Extras", icon: IconSprout },
  { to: "/cronograma", label: "Cronograma", icon: IconGrid },
  { to: "/recomendacoes", label: "Recomendações", icon: IconStar },
  { to: "/historico", label: "Histórico", icon: IconChart },
  { to: "/agenda", label: "Agenda", icon: IconCheckList },
];

const ADMIN: Item[] = [
  { to: "/admin", label: "Visão do sistema", icon: IconShield, end: true },
  { to: "/admin/usuarios", label: "Usuários", icon: IconUsers },
  { to: "/admin/cursos", label: "Cursos", icon: IconBook },
  { to: "/admin/periodos", label: "Períodos", icon: IconCal },
  { to: "/admin/avisos", label: "Avisos", icon: IconMegaphone },
  { to: "/admin/monitor", label: "Monitor", icon: IconPulse },
  { to: "/admin/config", label: "Configurações", icon: IconServer },
];

const ACCOUNT: Item[] = [
  { to: "/config", label: "Ajustes", icon: IconSliders },
  { to: "/ajuda", label: "Ajuda", icon: IconInfo },
];

type Props = {
  onLogout: () => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** slot da direita: seletor de curso e chip de período, montados pelo layout */
  children?: React.ReactNode;
};

const brandMark = APP_NAME.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "P";

export default function TopNav({ onLogout, open, onToggle, onClose, children }: Props) {
  const user = useAuth((s) => s.user);
  const items = user?.role === "ADMIN" ? ADMIN : STUDENT;
  const initials = (user?.name ?? "?").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  const link = ({ to, label, end }: Item) => (
    <NavLink key={to} to={to} {...(end ? { end: true } : {})}
      className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
      {label}
    </NavLink>
  );

  return (
    <header className="rail">
      <div className="rail-in">
        <a href="#conteudo" className="brandmark">
          <span className="brandmark-sq" aria-hidden="true">{brandMark}</span>
          <span className="brandmark-tx">{APP_NAME}</span>
        </a>

        {/* régua de navegação — no desktop; no mobile vira a gaveta abaixo */}
        <nav className="rail-nav" aria-label="Navegação principal">{items.map(link)}</nav>

        <div className="rail-end">
          {children}
          {/* a paleta escuta Ctrl/⌘+K globalmente; este botão é o caminho para quem usa mouse */}
          <button className="kbd-hint" title="Paleta de comandos (Ctrl+K)" onClick={openPalette}>
            <IconCommand /><span className="hide-sm">Ctrl K</span>
          </button>
          <ThemeToggle />
          <div className="rail-user">
            <span className="avatar" aria-hidden="true">{initials}</span>
            <span className="rail-user-tx">
              <strong>{user?.name}</strong>
              <small>{user?.role === "ADMIN" ? "administração" : user?.email}</small>
            </span>
            <button className="icon-btn" onClick={onLogout} title="Sair" aria-label="Sair"><IconOut /></button>
          </div>
          <button className="hamburger" onClick={onToggle} aria-expanded={open}
            aria-label={open ? "Fechar menu" : "Abrir menu"}>
            {open ? <IconX /> : <IconMenu />}
          </button>
        </div>
      </div>

      {/* gaveta mobile: os mesmos destinos, empilhados e com ícone */}
      {open && (
        <div className="rail-drawer">
          <nav aria-label="Navegação (mobile)">
            {[...items, ...ACCOUNT].map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} {...(end ? { end: true } : {})} onClick={onClose}
                className={({ isActive }) => "drawer-link" + (isActive ? " active" : "")}>
                <Icon /> {label}
              </NavLink>
            ))}
            <button className="drawer-link" onClick={onLogout}><IconOut /> Sair</button>
          </nav>
        </div>
      )}
    </header>
  );
}

export { ACCOUNT as ACCOUNT_ITEMS };
