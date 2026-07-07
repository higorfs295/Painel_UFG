// Abas de navegação. Admin só aparece para role=ADMIN.
import { NavLink } from "react-router-dom";
import { useAuth } from "../../store/auth";

const TABS = [
  { to: "/", label: "Visão geral", end: true },
  { to: "/disciplinas", label: "Disciplinas" },
  { to: "/extras", label: "Extras" },
  { to: "/cronograma", label: "Cronograma" },
  { to: "/config", label: "Ajustes" },
];

export default function NavTabs() {
  const isAdmin = useAuth((s) => s.user?.role === "ADMIN");
  return (
    <nav className="nav">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? "active" : "")}>
          {t.label}
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>Admin</NavLink>
      )}
    </nav>
  );
}
