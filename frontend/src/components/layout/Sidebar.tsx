// Trilho lateral do dashboard: marca, navegação com ícones e cartão do usuário com saída.
// No mobile (≤900px) vira barra horizontal rolável no topo (ver app.css .sidebar).
import { NavLink } from "react-router-dom";
import { useAuth } from "../../store/auth";
import { APP_NAME } from "../../branding";
import { IconSun, IconBook, IconSprout, IconGrid, IconSliders, IconShield, IconOut } from "../ui/Icons";

const LINKS = [
  { to: "/", label: "Visão geral", icon: IconSun, end: true },
  { to: "/disciplinas", label: "Disciplinas", icon: IconBook },
  { to: "/extras", label: "Extras", icon: IconSprout },
  { to: "/cronograma", label: "Cronograma", icon: IconGrid },
  { to: "/config", label: "Ajustes", icon: IconSliders },
];

export default function Sidebar({ onLogout }: { onLogout: () => void }) {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const initials = (user?.name ?? "?")
    .split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  return (
    <aside className="sidebar">
      <div className="side-brand">
        <span className="dot" />
        <span className="side-brand-name">{APP_NAME}</span>
      </div>

      <nav className="side-nav" aria-label="Navegação principal">
        {LINKS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => "side-link" + (isActive ? " active" : "")}>
            <Icon /> <span>{label}</span>
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => "side-link" + (isActive ? " active" : "")}>
            <IconShield /> <span>Admin</span>
          </NavLink>
        )}
      </nav>

      <div className="side-user">
        <span className="avatar" aria-hidden="true">{initials}</span>
        <span className="side-user-info">
          <strong>{user?.name}</strong>
          <small className="mut">{user?.email}</small>
        </span>
        <button className="side-out" onClick={onLogout} title="Sair" aria-label="Sair">
          <IconOut />
        </button>
      </div>
    </aside>
  );
}
