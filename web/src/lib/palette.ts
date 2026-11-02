// Cores com SIGNIFICADO (v12). Situação de disciplina, composição curricular, tipo de tarefa e
// público de aviso têm cor fixa: "aprovada" é sempre verde, em qualquer tema e com qualquer cor
// de destaque. O destaque (brand-*) fica para a interface: botões, links, item ativo, foco.
//
// Os nomes são chaves de `chartColors` (lib/chart-utils.ts), para os gráficos da Tremor e as
// peças próprias (anel, rosca, mapa de calor) falarem a mesma língua. Tons conferidos em
// docs/DESIGN.md: texto em 700 no claro e 400 no escuro (≥ 4,5:1), marcas gráficas em 600/500
// (≥ 3:1).
import type { AvailableChartColorsKeys } from "./chart-utils";
import type { GraphStatus, SubjectState, TaskKind, Audience } from "./api/types";

export type Tone = AvailableChartColorsKeys;

/**
 * Classes prontas por cor: ponto/barra (`dot`, elemento gráfico ≥ 3:1), texto, selo suave,
 * borda e `solid` — fundo cheio COM TEXTO por cima (avatar, azulejo de iniciais): 700 com
 * branco no claro e 400 com gray-950 no escuro, para passar em 4,5:1 em todas as cores.
 */
export const toneClass: Record<string, { dot: string; text: string; soft: string; border: string; ring: string; solid: string }> = {
  brand:   { dot: "bg-brand-600 dark:bg-brand-500", text: "text-brand-700 dark:text-brand-400", soft: "bg-brand-50 text-brand-800 ring-brand-600/25 dark:bg-brand-400/10 dark:text-brand-300 dark:ring-brand-400/25", border: "border-brand-500", ring: "ring-brand-500/30", solid: "bg-brand-700 text-white dark:bg-brand-400 dark:text-gray-950" },
  emerald: { dot: "bg-emerald-600 dark:bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", soft: "bg-emerald-50 text-emerald-800 ring-emerald-600/25 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25", border: "border-emerald-500", ring: "ring-emerald-500/30", solid: "bg-emerald-700 text-white dark:bg-emerald-400 dark:text-gray-950" },
  blue:    { dot: "bg-blue-600 dark:bg-blue-500", text: "text-blue-700 dark:text-blue-400", soft: "bg-blue-50 text-blue-800 ring-blue-600/25 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/25", border: "border-blue-500", ring: "ring-blue-500/30", solid: "bg-blue-700 text-white dark:bg-blue-400 dark:text-gray-950" },
  violet:  { dot: "bg-violet-600 dark:bg-violet-500", text: "text-violet-700 dark:text-violet-400", soft: "bg-violet-50 text-violet-800 ring-violet-600/25 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/25", border: "border-violet-500", ring: "ring-violet-500/30", solid: "bg-violet-700 text-white dark:bg-violet-400 dark:text-gray-950" },
  amber:   { dot: "bg-amber-600 dark:bg-amber-500", text: "text-amber-700 dark:text-amber-400", soft: "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25", border: "border-amber-500", ring: "ring-amber-500/30", solid: "bg-amber-700 text-white dark:bg-amber-400 dark:text-gray-950" },
  gray:    { dot: "bg-gray-400 dark:bg-gray-600", text: "text-gray-600 dark:text-gray-400", soft: "bg-gray-50 text-gray-700 ring-gray-500/25 dark:bg-gray-400/10 dark:text-gray-300 dark:ring-gray-400/25", border: "border-gray-400", ring: "ring-gray-400/30", solid: "bg-gray-600 text-white dark:bg-gray-400 dark:text-gray-950" },
  cyan:    { dot: "bg-cyan-600 dark:bg-cyan-500", text: "text-cyan-700 dark:text-cyan-400", soft: "bg-cyan-50 text-cyan-800 ring-cyan-600/25 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/25", border: "border-cyan-500", ring: "ring-cyan-500/30", solid: "bg-cyan-700 text-white dark:bg-cyan-400 dark:text-gray-950" },
  indigo:  { dot: "bg-indigo-600 dark:bg-indigo-500", text: "text-indigo-700 dark:text-indigo-400", soft: "bg-indigo-50 text-indigo-800 ring-indigo-600/25 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/25", border: "border-indigo-500", ring: "ring-indigo-500/30", solid: "bg-indigo-700 text-white dark:bg-indigo-400 dark:text-gray-950" },
  fuchsia: { dot: "bg-fuchsia-600 dark:bg-fuchsia-500", text: "text-fuchsia-700 dark:text-fuchsia-400", soft: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-600/25 dark:bg-fuchsia-400/10 dark:text-fuchsia-300 dark:ring-fuchsia-400/25", border: "border-fuchsia-500", ring: "ring-fuchsia-500/30", solid: "bg-fuchsia-700 text-white dark:bg-fuchsia-400 dark:text-gray-950" },
  lime:    { dot: "bg-lime-600 dark:bg-lime-500", text: "text-lime-700 dark:text-lime-400", soft: "bg-lime-50 text-lime-800 ring-lime-600/25 dark:bg-lime-400/10 dark:text-lime-300 dark:ring-lime-400/25", border: "border-lime-500", ring: "ring-lime-500/30", solid: "bg-lime-700 text-white dark:bg-lime-400 dark:text-gray-950" },
  pink:    { dot: "bg-pink-600 dark:bg-pink-500", text: "text-pink-700 dark:text-pink-400", soft: "bg-pink-50 text-pink-800 ring-pink-600/25 dark:bg-pink-400/10 dark:text-pink-300 dark:ring-pink-400/25", border: "border-pink-500", ring: "ring-pink-500/30", solid: "bg-pink-700 text-white dark:bg-pink-400 dark:text-gray-950" },
  rose:    { dot: "bg-rose-600 dark:bg-rose-500", text: "text-rose-700 dark:text-rose-400", soft: "bg-rose-50 text-rose-800 ring-rose-600/25 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/25", border: "border-rose-500", ring: "ring-rose-500/30", solid: "bg-rose-700 text-white dark:bg-rose-400 dark:text-gray-950" },
  red:     { dot: "bg-red-600 dark:bg-red-500", text: "text-red-700 dark:text-red-400", soft: "bg-red-50 text-red-800 ring-red-600/25 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25", border: "border-red-500", ring: "ring-red-500/30", solid: "bg-red-700 text-white dark:bg-red-400 dark:text-gray-950" },
  sky:     { dot: "bg-sky-600 dark:bg-sky-500", text: "text-sky-700 dark:text-sky-400", soft: "bg-sky-50 text-sky-800 ring-sky-600/25 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25", border: "border-sky-500", ring: "ring-sky-500/30", solid: "bg-sky-700 text-white dark:bg-sky-400 dark:text-gray-950" },
  teal:    { dot: "bg-teal-600 dark:bg-teal-500", text: "text-teal-700 dark:text-teal-400", soft: "bg-teal-50 text-teal-800 ring-teal-600/25 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/25", border: "border-teal-500", ring: "ring-teal-500/30", solid: "bg-teal-700 text-white dark:bg-teal-400 dark:text-gray-950" },
  orange:  { dot: "bg-orange-600 dark:bg-orange-500", text: "text-orange-700 dark:text-orange-400", soft: "bg-orange-50 text-orange-800 ring-orange-600/25 dark:bg-orange-400/10 dark:text-orange-300 dark:ring-orange-400/25", border: "border-orange-500", ring: "ring-orange-500/30", solid: "bg-orange-700 text-white dark:bg-orange-400 dark:text-gray-950" },
};
export const tone = (t: string) => toneClass[t] ?? toneClass.gray!;

/** Situação da disciplina: estado salvo (aprovada/cursando/simulada) ou situação no grafo. */
export type Situation = "done" | "enrolled" | "sim" | "avail" | "co" | "lock";
export const SITUATION: Record<Situation, { label: string; tone: Tone }> = {
  done: { label: "Aprovada", tone: "emerald" },
  enrolled: { label: "Cursando", tone: "blue" },
  sim: { label: "Simulada", tone: "violet" },
  avail: { label: "Disponível", tone: "amber" },
  co: { label: "Com correquisito", tone: "sky" },
  lock: { label: "Bloqueada", tone: "gray" },
};
export function situationOf(state: SubjectState | null, status: GraphStatus): Situation {
  if (state === "APPROVED") return "done";
  if (state === "ENROLLED") return "enrolled";
  if (state === "SIMULATED") return "sim";
  return status === "done" ? "done" : status;
}

/** Composições curriculares (chaves do JSON da matriz). Desconhecidas giram na reserva. */
const COMPOSITION: Record<string, Tone> = { NC: "cyan", NEO: "indigo", OPT: "fuchsia", NL: "lime", AC: "pink" };
const RESERVE: Tone[] = ["teal", "sky", "rose", "amber", "violet"];
export const compositionTone = (key: string, i = 0): Tone => COMPOSITION[key] ?? RESERVE[i % RESERVE.length]!;

export const TASK_TONE: Record<TaskKind, Tone> = { PROVA: "red", TRABALHO: "blue", ENTREGA: "amber", OUTRO: "gray" };
export const AUDIENCE_TONE: Record<Audience, Tone> = { ALL: "brand", STUDENTS: "emerald", ADMINS: "violet" };

/** Cor estável para um texto qualquer (avatar, curso): mesma entrada, mesma cor. */
const AVATAR: Tone[] = ["blue", "emerald", "violet", "amber", "cyan", "pink", "indigo", "teal", "rose", "lime"];
export function hashTone(text: string): Tone {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return AVATAR[h % AVATAR.length]!;
}
