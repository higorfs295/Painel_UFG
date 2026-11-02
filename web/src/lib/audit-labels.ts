// Rótulos legíveis para as ações da trilha de auditoria (v12) — usados no feed da Visão do
// sistema e na tela de Auditoria. Ação desconhecida aparece com o código cru.
import {
  RiBookOpenLine, RiCalendar2Line, RiDeleteBinLine, RiErrorWarningLine, RiFileChartLine, RiLoginBoxLine,
  RiLogoutBoxRLine, RiMegaphoneLine, RiRestartLine, RiSettings3Line, RiShieldUserLine, RiUserAddLine,
  RiUserSettingsLine, RiUploadCloud2Line, RiQuestionLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import type { AuditEntry } from "./api/types";

type Label = { text: (e: AuditEntry) => string; icon: RemixiconComponentType; tone: string; group: string };

const target = (e: AuditEntry) => {
  const m = (e.meta ?? {}) as Record<string, unknown>;
  return typeof m.target === "string" ? m.target : typeof m.slug === "string" ? m.slug : typeof m.title === "string" ? `“${m.title}”` : e.entityId ?? "";
};

const LABELS: Record<string, Label> = {
  "auth.login": { text: () => "entrou no sistema", icon: RiLoginBoxLine, tone: "blue", group: "Acesso" },
  "auth.login_failed": { text: () => "errou a senha", icon: RiErrorWarningLine, tone: "red", group: "Acesso" },
  "auth.revoke_others": { text: () => "encerrou as outras sessões", icon: RiLogoutBoxRLine, tone: "gray", group: "Acesso" },
  "user.role": { text: (e) => `mudou o papel de ${target(e)}`, icon: RiShieldUserLine, tone: "violet", group: "Usuários" },
  "user.update": { text: (e) => `editou o cadastro de ${target(e)}`, icon: RiUserSettingsLine, tone: "violet", group: "Usuários" },
  "user.import": { text: (e) => `importou ${((e.meta ?? {}) as { created?: number }).created ?? "?"} conta(s) em lote`, icon: RiUserAddLine, tone: "emerald", group: "Usuários" },
  "user.delete": { text: (e) => `removeu a conta ${target(e)}`, icon: RiDeleteBinLine, tone: "red", group: "Usuários" },
  "user.sessions_revoke": { text: (e) => `encerrou as sessões de ${target(e)}`, icon: RiLogoutBoxRLine, tone: "amber", group: "Usuários" },
  "course.import": { text: (e) => `importou a matriz ${e.entityId ?? ""}`, icon: RiUploadCloud2Line, tone: "emerald", group: "Cursos" },
  "course.update": { text: (e) => `editou o curso ${e.entityId ?? ""}`, icon: RiBookOpenLine, tone: "blue", group: "Cursos" },
  "course.trash": { text: (e) => `mandou ${target(e)} para a lixeira`, icon: RiDeleteBinLine, tone: "amber", group: "Cursos" },
  "course.restore": { text: (e) => `restaurou ${target(e)}`, icon: RiRestartLine, tone: "emerald", group: "Cursos" },
  "course.purge": { text: (e) => `apagou ${target(e)} de vez`, icon: RiDeleteBinLine, tone: "red", group: "Cursos" },
  "period.schedule": { text: () => "agendou uma virada de período", icon: RiCalendar2Line, tone: "cyan", group: "Calendário" },
  "period.delete": { text: () => "removeu uma virada de período", icon: RiCalendar2Line, tone: "gray", group: "Calendário" },
  "announcement.create": { text: (e) => `publicou ${target(e)}`, icon: RiMegaphoneLine, tone: "brand", group: "Avisos" },
  "announcement.update": { text: () => "editou um aviso", icon: RiMegaphoneLine, tone: "brand", group: "Avisos" },
  "announcement.delete": { text: () => "removeu um aviso", icon: RiMegaphoneLine, tone: "gray", group: "Avisos" },
  "settings.update": { text: () => "mudou as configurações da instância", icon: RiSettings3Line, tone: "violet", group: "Configurações" },
  "report.course": { text: (e) => `abriu o relatório de ${e.entityId ?? "um curso"}`, icon: RiFileChartLine, tone: "cyan", group: "Relatórios" },
};

export function auditLabel(e: AuditEntry): Label & { line: string } {
  const l = LABELS[e.action] ?? { text: () => e.action, icon: RiQuestionLine, tone: "gray", group: "Outros" };
  return { ...l, line: l.text(e) };
}

/** Grupos para o filtro rápido (prefixo da ação). */
export const AUDIT_GROUPS = [
  { v: "", label: "Tudo" },
  { v: "auth.", label: "Acesso" },
  { v: "user.", label: "Usuários" },
  { v: "course.", label: "Cursos" },
  { v: "announcement.", label: "Avisos" },
  { v: "period.", label: "Calendário" },
  { v: "settings.", label: "Configurações" },
  { v: "report.", label: "Relatórios" },
] as const;

/** Quem fez: a conta; "conta removida" quando ela já não existe (a trilha guarda o registro). */
export function actorName(e: AuditEntry) {
  if (e.user?.name) return e.user.name;
  return e.action === "auth.login_failed" ? "Tentativa anônima" : "Conta removida";
}
