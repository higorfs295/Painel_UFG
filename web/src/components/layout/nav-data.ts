// Mapa de navegação declarativo — a ideia do `sidebar/data` do nextjs-admin-dashboard:
// a estrutura do menu é dado, não JSX, o que deixa a sidebar e a paleta de comandos
// lerem a MESMA fonte (e nunca divergirem).
import type { ComponentType, SVGProps } from "react";
import {
  IconSun, IconBook, IconSprout, IconGrid, IconSliders, IconShield, IconUsers, IconCal,
  IconStar, IconServer, IconInfo, IconChart, IconCheckList, IconPulse, IconMegaphone,
} from "@/components/ui/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** cor do azulejo do ícone — lê bem sobre o gradiente do trilho */
  color: string;
  /** só casa exatamente (evita a raiz ficar sempre ativa) */
  exact?: boolean;
};
export type NavSection = { label: string; items: NavItem[] };

const C = {
  gold: "#FFD27A", mint: "#7FD1C4", leaf: "#AFDB8B", sky: "#9DB8FF",
  coral: "#FFAE86", lav: "#E3C7FF", jeni: "#86D3E6",
};

const CONTA: NavSection = {
  label: "Conta",
  items: [
    { href: "/config", label: "Ajustes", icon: IconSliders, color: C.lav },
    { href: "/ajuda", label: "Ajuda", icon: IconInfo, color: C.jeni },
  ],
};

export const STUDENT_NAV: NavSection[] = [
  {
    label: "Jornada",
    items: [
      { href: "/painel", label: "Visão geral", icon: IconSun, color: C.gold, exact: true },
      { href: "/painel/disciplinas", label: "Disciplinas", icon: IconBook, color: C.mint },
      { href: "/painel/extras", label: "Extras", icon: IconSprout, color: C.leaf },
      { href: "/painel/cronograma", label: "Cronograma", icon: IconGrid, color: C.sky },
      { href: "/painel/recomendacoes", label: "Recomendações", icon: IconStar, color: C.coral },
      { href: "/painel/historico", label: "Histórico", icon: IconChart, color: C.jeni },
      { href: "/painel/agenda", label: "Agenda", icon: IconCheckList, color: C.lav },
    ],
  },
  CONTA,
];

export const ADMIN_NAV: NavSection[] = [
  {
    label: "Sistema",
    items: [
      { href: "/admin", label: "Visão do sistema", icon: IconShield, color: C.gold, exact: true },
      { href: "/admin/usuarios", label: "Usuários", icon: IconUsers, color: C.mint },
      { href: "/admin/cursos", label: "Cursos", icon: IconBook, color: C.leaf },
      { href: "/admin/periodos", label: "Períodos", icon: IconCal, color: C.sky },
      { href: "/admin/avisos", label: "Avisos", icon: IconMegaphone, color: C.coral },
      { href: "/admin/monitor", label: "Monitor", icon: IconPulse, color: C.jeni },
      { href: "/admin/config", label: "Configurações", icon: IconServer, color: C.lav },
    ],
  },
  CONTA,
];

export const navFor = (role: string | undefined) => (role === "ADMIN" ? ADMIN_NAV : STUDENT_NAV);

/** Casa a rota atual com um item — `exact` evita que a raiz do grupo fique sempre ativa. */
export const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
