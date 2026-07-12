// Trilho lateral do dashboard: marca, navegação agrupada (com ícones coloridos) e cartão do usuário.
// Papel-consciente: aluno vê a jornada acadêmica; ADMIN vê só a gestão do sistema.
// Colapsável no desktop; no mobile (≤900px) vira gaveta off-canvas controlada pelo hambúrguer.
import type { ComponentType, SVGProps } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../store/auth";
import { APP_NAME } from "../../branding";
import {
  IconSun, IconBook, IconSprout, IconGrid, IconSliders, IconShield,
  IconOut, IconUsers, IconCal, IconX, IconMenu, IconStar, IconServer, IconInfo,
} from "../ui/Icons";

type Item = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; color: string; end?: boolean };
type Group = { label: string; items: Item[] };

// cores vivas que lêem bem sobre o gradiente escuro da sidebar (riqueza de cor nos ícones)
const C = {
  gold: "#FFD27A", mint: "#7FD1C4", leaf: "#AFDB8B", sky: "#9DB8FF",
  coral: "#FFAE86", lav: "#E3C7FF", jeni: "#86D3E6",
};

const STUDENT_GROUPS: Group[] = [
  {
    label: "Jornada",
    items: [
      { to: "/", label: "Visão geral", icon: IconSun, color: C.gold, end: true },
      { to: "/disciplinas", label: "Disciplinas", icon: IconBook, color: C.mint },
      { to: "/extras", label: "Extras", icon: IconSprout, color: C.leaf },
      { to: "/cronograma", label: "Cronograma", icon: IconGrid, color: C.sky },
      { to: "/recomendacoes", label: "Recomendações", icon: IconStar, color: C.coral },
    ],
  },
  {
    label: "Conta",
    items: [
      { to: "/config", label: "Ajustes", icon: IconSliders, color: C.lav },
      { to: "/ajuda", label: "Ajuda", icon: IconInfo, color: C.jeni },
    ],
  },
];

const ADMIN_GROUPS: Group[] = [
  {
    label: "Sistema",
    items: [
      { to: "/admin", label: "Visão do sistema", icon: IconShield, color: C.gold, end: true },
      { to: "/admin/usuarios", label: "Usuários", icon: IconUsers, color: C.mint },
      { to: "/admin/cursos", label: "Cursos", icon: IconBook, color: C.leaf },
      { to: "/admin/periodos", label: "Períodos", icon: IconCal, color: C.sky },
      { to: "/admin/config", label: "Configurações", icon: IconServer, color: C.coral },
    ],
  },
  {
    label: "Conta",
    items: [
      { to: "/config", label: "Ajustes", icon: IconSliders, color: C.lav },
      { to: "/ajuda", label: "Ajuda", icon: IconInfo, color: C.jeni },
    ],
  },
];

type Props = {
  onLogout: () => void; open: boolean; onClose: () => void;
  collapsed: boolean; onToggleCollapse: () => void;
};

const brandMark = APP_NAME.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "P";

export default function Sidebar({ onLogout, open, onClose, collapsed, onToggleCollapse }: Props) {
  const user = useAuth((s) => s.user);
  const groups = user?.role === "ADMIN" ? ADMIN_GROUPS : STUDENT_GROUPS;
  const initials = (user?.name ?? "?")
    .split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  return (
    <aside className={"sidebar" + (open ? " open" : "")}>
      <div className="side-brand">
        <span className="side-logo" aria-hidden="true">{brandMark}</span>
        <span className="side-brand-name">{APP_NAME}</span>
        {/* colapsar no desktop; fechar a gaveta no mobile */}
        <button className="side-collapse" onClick={onToggleCollapse}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir" : "Recolher"}>
          <IconMenu />
        </button>
        <button className="side-close" onClick={onClose} aria-label="Fechar menu"><IconX /></button>
      </div>

      <nav className="side-nav" aria-label="Navegação principal">
        {groups.map((g) => (
          <div className="side-group" key={g.label}>
            <span className="side-group-label">{g.label}</span>
            {g.items.map(({ to, label, icon: Icon, color, end }) => (
              <NavLink key={to} to={to} {...(end ? { end: true } : {})} title={label}
                className={({ isActive }) => "side-link" + (isActive ? " active" : "")}>
                <span className="side-ico" style={{ ["--ic" as string]: color }}><Icon /></span>
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="side-user">
        <span className="avatar" aria-hidden="true">{initials}</span>
        <span className="side-user-info">
          <strong>{user?.name}</strong>
          <small>{user?.role === "ADMIN" ? "administra o sistema" : user?.email}</small>
        </span>
        <button className="side-out" onClick={onLogout} title="Sair" aria-label="Sair">
          <IconOut />
        </button>
      </div>
    </aside>
  );
}
