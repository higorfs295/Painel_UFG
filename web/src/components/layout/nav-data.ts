// Mapa de navegação declarativo: a sidebar, a gaveta do mobile e a paleta de comandos
// leem a MESMA fonte (e nunca divergem). Ícones Remix, como no template da Tremor.
import type { RemixiconComponentType } from "@remixicon/react";
import {
  RiBookOpenLine, RiCalendarCheckLine, RiDashboardLine, RiFileList3Line, RiGitMergeLine,
  RiLineChartLine, RiMegaphoneLine, RiPulseLine, RiQuestionLine, RiServerLine, RiSettings5Line,
  RiShieldUserLine, RiSparkling2Line, RiStackLine, RiTableLine, RiTeamLine, RiCalendar2Line,
} from "@remixicon/react";

export type NavItem = {
  href: string;
  label: string;
  icon: RemixiconComponentType;
  /** frase curta para a paleta de comandos */
  hint?: string;
  /** só casa exatamente (evita a raiz ficar sempre ativa) */
  exact?: boolean;
  /** mostra a contagem de avisos não lidos */
  badge?: "avisos";
};
/** `label` vazio = grupo principal, sem título (como a lista de cima do template). */
export type NavSection = { label: string; items: NavItem[] };

const CONTA: NavSection = {
  label: "Conta",
  items: [
    { href: "/config", label: "Ajustes", icon: RiSettings5Line, hint: "perfil, tema, senha, cursos e backup" },
    { href: "/ajuda", label: "Ajuda", icon: RiQuestionLine, hint: "como o cálculo funciona" },
  ],
};

export const STUDENT_NAV: NavSection[] = [
  {
    label: "",
    items: [
      { href: "/painel", label: "Visão geral", icon: RiDashboardLine, exact: true, hint: "integralização, marcos e ritmo" },
      { href: "/painel/disciplinas", label: "Disciplinas", icon: RiBookOpenLine, hint: "matriz, situação, notas e anotações" },
      { href: "/painel/mapa", label: "Mapa curricular", icon: RiGitMergeLine, hint: "cadeia de pré-requisitos" },
      { href: "/painel/extras", label: "Extras", icon: RiStackLine, hint: "optativas, núcleo livre e complementares" },
      { href: "/painel/historico", label: "Histórico", icon: RiLineChartLine, hint: "notas por período, MGA e ritmo" },
    ],
  },
  {
    label: "Semestre",
    items: [
      { href: "/painel/recomendacoes", label: "Recomendações", icon: RiSparkling2Line, hint: "o que mais destrava" },
      { href: "/painel/cronograma", label: "Cronograma", icon: RiTableLine, hint: "cenários de grade com códigos SIGAA" },
      { href: "/painel/agenda", label: "Agenda", icon: RiCalendarCheckLine, hint: "provas, trabalhos e entregas" },
      { href: "/painel/avisos", label: "Avisos", icon: RiMegaphoneLine, hint: "comunicados da coordenação", badge: "avisos" },
    ],
  },
  CONTA,
];

export const ADMIN_NAV: NavSection[] = [
  {
    label: "",
    items: [
      { href: "/admin", label: "Visão do sistema", icon: RiShieldUserLine, exact: true, hint: "números da instância" },
      { href: "/admin/usuarios", label: "Usuários", icon: RiTeamLine, hint: "convites, papéis e matrículas" },
      { href: "/admin/cursos", label: "Cursos", icon: RiBookOpenLine, hint: "matrizes e lixeira" },
      { href: "/admin/periodos", label: "Períodos", icon: RiCalendar2Line, hint: "calendário acadêmico" },
      { href: "/admin/avisos", label: "Avisos", icon: RiMegaphoneLine, hint: "comunicados por público" },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/admin/monitor", label: "Monitor", icon: RiPulseLine, hint: "métricas e auditoria" },
      { href: "/admin/config", label: "Configurações", icon: RiServerLine, hint: "e-mail, cadastro, ambiente" },
    ],
  },
  CONTA,
];

/** Histórico do aluno também tem um atalho de arquivo; mantido aqui para a paleta. */
export const EXTRA_COMMANDS = [{ href: "/painel/historico", label: "Exportar histórico (CSV)", icon: RiFileList3Line }];

export const navFor = (role: string | undefined) => (role === "ADMIN" ? ADMIN_NAV : STUDENT_NAV);

/** Casa a rota atual com um item — `exact` evita que a raiz do grupo fique sempre ativa. */
export const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
