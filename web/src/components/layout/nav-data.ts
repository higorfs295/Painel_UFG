// Mapa de navegação declarativo: a sidebar, a gaveta do mobile e a paleta de comandos
// leem a MESMA fonte (e nunca divergem). Ícones Remix, como no template da Tremor.
import type { RemixiconComponentType } from "@remixicon/react";
import {
  RiBookOpenLine, RiCalendarCheckLine, RiDashboardLine, RiFileList3Line, RiGitMergeLine,
  RiLineChartLine, RiMegaphoneLine, RiPulseLine, RiQuestionLine, RiServerLine, RiSettings5Line,
  RiShieldUserLine, RiSparkling2Line, RiStackLine, RiTableLine, RiTeamLine, RiCalendar2Line,
  RiBarChartBoxLine, RiFileShield2Line, RiUserHeartLine,
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
      { href: "/admin", label: "Visão do sistema", icon: RiShieldUserLine, exact: true, hint: "cadastros, acessos e atividade" },
      { href: "/admin/usuarios", label: "Usuários", icon: RiTeamLine, hint: "convites, lote, papéis e sessões" },
      { href: "/admin/cursos", label: "Cursos", icon: RiBookOpenLine, hint: "matrizes, importação e lixeira" },
      { href: "/admin/relatorios", label: "Relatórios", icon: RiBarChartBoxLine, hint: "agregados por curso, sem dado individual" },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { href: "/admin/avisos", label: "Avisos", icon: RiMegaphoneLine, hint: "por público, curso e agendados" },
      { href: "/admin/periodos", label: "Períodos", icon: RiCalendar2Line, hint: "calendário acadêmico" },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/admin/monitor", label: "Monitor", icon: RiPulseLine, hint: "tráfego ao vivo e saúde" },
      { href: "/admin/auditoria", label: "Auditoria", icon: RiFileShield2Line, hint: "quem fez o quê, com busca" },
      { href: "/admin/config", label: "Configurações", icon: RiServerLine, hint: "cadastro, faixa de aviso, e-mail" },
    ],
  },
  CONTA,
];

/** v12: o admin que também cursa ganha o atalho para a outra área no fim da lista. */
const TO_STUDENT: NavSection = {
  label: "Pessoal",
  items: [{ href: "/painel", label: "Meu painel", icon: RiUserHeartLine, exact: true, hint: "acompanhar o seu próprio curso" }],
};
const TO_ADMIN: NavSection = {
  label: "Gestão",
  items: [{ href: "/admin", label: "Administração", icon: RiShieldUserLine, exact: true, hint: "voltar para a gestão" }],
};

/** Histórico do aluno também tem um atalho de arquivo; mantido aqui para a paleta. */
export const EXTRA_COMMANDS = [{ href: "/painel/historico", label: "Exportar histórico (CSV)", icon: RiFileList3Line }];

/**
 * Navegação da área atual. O aluno só tem a dele; o admin (v12) alterna: em /painel vê a do
 * aluno + o atalho de volta, no resto vê a de gestão + o atalho para "Meu painel".
 */
export function navFor(role: string | undefined, pathname = "") {
  if (role !== "ADMIN") return STUDENT_NAV;
  const student = pathname === "/painel" || pathname.startsWith("/painel/");
  return student ? [...STUDENT_NAV.slice(0, -1), TO_ADMIN, CONTA] : [...ADMIN_NAV.slice(0, -1), TO_STUDENT, CONTA];
}

/** Para a paleta de comandos: o admin alcança as duas áreas de qualquer lugar. */
export function allNavFor(role: string | undefined) {
  if (role !== "ADMIN") return STUDENT_NAV;
  return [...ADMIN_NAV.slice(0, -1), ...STUDENT_NAV.slice(0, -1).map((s) => ({ ...s, label: s.label ? `Meu painel · ${s.label}` : "Meu painel" })), CONTA];
}

/** Casa a rota atual com um item — `exact` evita que a raiz do grupo fique sempre ativa. */
export const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
