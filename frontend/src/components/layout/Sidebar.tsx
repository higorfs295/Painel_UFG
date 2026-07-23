// Trilho lateral: marca, navegação agrupada com ícones coloridos e cartão do usuário.
// Papel-consciente (aluno vê a jornada; ADMIN vê a gestão), colapsável no desktop e
// gaveta off-canvas no mobile.
//
// A estrutura é a da v6 — que funcionava melhor que o trilho superior da v7. O que mudou
// é a implementação: utilitários Tailwind no lugar de CSS próprio, com estados de foco por
// `ring` e uma pílula ativa mais discreta. O gradiente de pôr-do-sol continua sendo a
// assinatura visual do produto.
import type { ComponentType, SVGProps } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../store/auth";
import { APP_NAME } from "../../branding";
import {
  IconSun, IconBook, IconSprout, IconGrid, IconSliders, IconShield,
  IconOut, IconUsers, IconCal, IconX, IconMenu, IconStar, IconServer, IconInfo,
  IconChart, IconCheckList, IconPulse, IconMegaphone,
} from "../ui/Icons";

type Item = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; color: string; end?: boolean };
type Group = { label: string; items: Item[] };

// cores vivas que lêem bem sobre o gradiente escuro do trilho
const C = {
  gold: "#FFD27A", mint: "#7FD1C4", leaf: "#AFDB8B", sky: "#9DB8FF",
  coral: "#FFAE86", lav: "#E3C7FF", jeni: "#86D3E6",
};

const ACCOUNT: Item[] = [
  { to: "/config", label: "Ajustes", icon: IconSliders, color: C.lav },
  { to: "/ajuda", label: "Ajuda", icon: IconInfo, color: C.jeni },
];

const STUDENT_GROUPS: Group[] = [
  {
    label: "Jornada",
    items: [
      { to: "/", label: "Visão geral", icon: IconSun, color: C.gold, end: true },
      { to: "/disciplinas", label: "Disciplinas", icon: IconBook, color: C.mint },
      { to: "/extras", label: "Extras", icon: IconSprout, color: C.leaf },
      { to: "/cronograma", label: "Cronograma", icon: IconGrid, color: C.sky },
      { to: "/recomendacoes", label: "Recomendações", icon: IconStar, color: C.coral },
      { to: "/historico", label: "Histórico", icon: IconChart, color: C.jeni },
      { to: "/agenda", label: "Agenda", icon: IconCheckList, color: C.lav },
    ],
  },
  { label: "Conta", items: ACCOUNT },
];

const ADMIN_GROUPS: Group[] = [
  {
    label: "Sistema",
    items: [
      { to: "/admin", label: "Visão do sistema", icon: IconShield, color: C.gold, end: true },
      { to: "/admin/usuarios", label: "Usuários", icon: IconUsers, color: C.mint },
      { to: "/admin/cursos", label: "Cursos", icon: IconBook, color: C.leaf },
      { to: "/admin/periodos", label: "Períodos", icon: IconCal, color: C.sky },
      { to: "/admin/avisos", label: "Avisos", icon: IconMegaphone, color: C.coral },
      { to: "/admin/monitor", label: "Monitor", icon: IconPulse, color: C.jeni },
      { to: "/admin/config", label: "Configurações", icon: IconServer, color: C.lav },
    ],
  },
  { label: "Conta", items: ACCOUNT },
];

type Props = {
  onLogout: () => void; open: boolean; onClose: () => void;
  collapsed: boolean; onToggleCollapse: () => void;
};

const brandMark = APP_NAME.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "P";

// botão-ícone claro, para uso sobre o gradiente (o .icon-btn global é para o conteúdo)
const railBtn = "grid place-items-center rounded-md p-1.5 text-sidebar-foreground/70 " +
  "transition-colors hover:bg-white/15 hover:text-sidebar-foreground cursor-pointer";

export default function Sidebar({ onLogout, open, onClose, collapsed, onToggleCollapse }: Props) {
  const user = useAuth((s) => s.user);
  const groups = user?.role === "ADMIN" ? ADMIN_GROUPS : STUDENT_GROUPS;
  const initials = (user?.name ?? "?")
    .split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  return (
    <aside
      style={{ background: "var(--sidebar-gradient)" }}
      className={[
        "text-sidebar-foreground fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-1 overflow-y-auto p-3",
        "shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 lg:shadow-none",
        collapsed ? "lg:w-[76px]" : "lg:w-64",
        open ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
    >
      {/* marca + controles */}
      <div className={"flex items-center gap-2.5 px-1 py-2 " + (collapsed ? "lg:flex-col lg:gap-3" : "")}>
        <span aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/15 font-display text-sm font-bold">
          {brandMark}
        </span>
        {!collapsed && (
          <span className="font-display truncate text-[0.95rem] font-semibold tracking-tight">{APP_NAME}</span>
        )}
        <button onClick={onToggleCollapse} className={railBtn + " ml-auto hidden lg:grid " + (collapsed ? "lg:ml-0" : "")}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir" : "Recolher"}>
          <IconMenu />
        </button>
        <button onClick={onClose} className={railBtn + " ml-auto lg:hidden"} aria-label="Fechar menu">
          <IconX />
        </button>
      </div>

      <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-5 py-2">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5">
            {!collapsed && (
              <span className="text-sidebar-foreground/45 px-3 pb-1.5 text-[0.6rem] font-semibold tracking-[0.18em] uppercase">
                {g.label}
              </span>
            )}
            {g.items.map(({ to, label, icon: Icon, color, end }) => (
              <NavLink key={to} to={to} {...(end ? { end: true } : {})} title={label}
                className={({ isActive }) => [
                  "group relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium",
                  "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                  collapsed ? "lg:justify-center lg:px-1.5" : "",
                  isActive
                    ? "bg-white/15 text-sidebar-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground",
                ].join(" ")}>
                {/* azulejo colorido: a cor é do item, não do tema */}
                <span aria-hidden="true"
                  style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, color }}
                  className="grid size-7 shrink-0 place-items-center rounded-md transition-transform group-hover:scale-105">
                  <Icon />
                </span>
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className={"mt-auto flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2 " +
        (collapsed ? "lg:flex-col lg:gap-2" : "")}>
        <span aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-[0.7rem] font-bold">
          {initials}
        </span>
        {!collapsed && (
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <strong className="truncate text-[0.8rem] font-semibold">{user?.name}</strong>
            <small className="text-sidebar-foreground/60 truncate text-[0.68rem]">
              {user?.role === "ADMIN" ? "administra o sistema" : user?.email}
            </small>
          </span>
        )}
        <button onClick={onLogout} className={railBtn} title="Sair" aria-label="Sair"><IconOut /></button>
      </div>
    </aside>
  );
}
