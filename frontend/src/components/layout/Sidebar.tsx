// Trilho lateral do dashboard: marca, navegação agrupada por seção e cartão do usuário.
// Papel-consciente: aluno vê a jornada acadêmica; ADMIN vê só a gestão do sistema.
// No mobile (≤900px) vira gaveta off-canvas controlada pelo hambúrguer da topbar.
import type { ComponentType, SVGProps } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../store/auth";
import { APP_NAME } from "../../branding";
import {
  IconSun, IconBook, IconSprout, IconGrid, IconSliders, IconShield,
  IconOut, IconUsers, IconCal, IconX,
} from "../ui/Icons";

type Item = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; end?: boolean };
type Group = { label: string; items: Item[] };

const STUDENT_GROUPS: Group[] = [
  {
    label: "Jornada",
    items: [
      { to: "/", label: "Visão geral", icon: IconSun, end: true },
      { to: "/disciplinas", label: "Disciplinas", icon: IconBook },
      { to: "/extras", label: "Extras", icon: IconSprout },
      { to: "/cronograma", label: "Cronograma", icon: IconGrid },
    ],
  },
  { label: "Conta", items: [{ to: "/config", label: "Ajustes", icon: IconSliders }] },
];

const ADMIN_GROUPS: Group[] = [
  {
    label: "Sistema",
    items: [
      { to: "/admin", label: "Visão do sistema", icon: IconShield, end: true },
      { to: "/admin/usuarios", label: "Usuários", icon: IconUsers },
      { to: "/admin/cursos", label: "Cursos", icon: IconBook },
      { to: "/admin/periodos", label: "Períodos", icon: IconCal },
    ],
  },
  { label: "Conta", items: [{ to: "/config", label: "Ajustes", icon: IconSliders }] },
];

type Props = { onLogout: () => void; open: boolean; onClose: () => void };

export default function Sidebar({ onLogout, open, onClose }: Props) {
  const user = useAuth((s) => s.user);
  const groups = user?.role === "ADMIN" ? ADMIN_GROUPS : STUDENT_GROUPS;
  const initials = (user?.name ?? "?")
    .split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  return (
    <aside className={"sidebar" + (open ? " open" : "")}>
      <div className="side-brand">
        <span className="dot" />
        <span className="side-brand-name">{APP_NAME}</span>
        <button className="side-close" onClick={onClose} aria-label="Fechar menu"><IconX /></button>
      </div>

      <nav className="side-nav" aria-label="Navegação principal">
        {groups.map((g) => (
          <div className="side-group" key={g.label}>
            <span className="side-group-label">{g.label}</span>
            {g.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} {...(end ? { end: true } : {})}
                className={({ isActive }) => "side-link" + (isActive ? " active" : "")}>
                <Icon /> <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="side-user">
        <span className="avatar" aria-hidden="true">{initials}</span>
        <span className="side-user-info">
          <strong>{user?.name}</strong>
          <small className="mut">{user?.role === "ADMIN" ? "administra o sistema" : user?.email}</small>
        </span>
        <button className="side-out" onClick={onLogout} title="Sair" aria-label="Sair">
          <IconOut />
        </button>
      </div>
    </aside>
  );
}
