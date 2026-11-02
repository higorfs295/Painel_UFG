"use client";

// Aparência (v12): cor de destaque e pele da barra lateral. A fonte da verdade é a conta
// (PATCH /me/settings, como o tema); o localStorage só guarda a última escolha para o script
// do <head> aplicá-la ANTES da primeira pintura — sem ele, a página piscaria em laranja e
// trocaria de cor ao hidratar.
import { useSyncExternalStore } from "react";
import type { Accent, SidebarStyle } from "./api/types";

export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "orange", label: "Laranja", swatch: "bg-orange-600" },
  { value: "blue", label: "Azul", swatch: "bg-blue-600" },
  { value: "violet", label: "Violeta", swatch: "bg-violet-600" },
  { value: "emerald", label: "Verde", swatch: "bg-emerald-600" },
  { value: "rose", label: "Rosa", swatch: "bg-rose-600" },
];
export const SIDEBARS: { value: SidebarStyle; label: string; hint: string }[] = [
  { value: "light", label: "Clara", hint: "a do template, acompanha o tema" },
  { value: "dark", label: "Escura", hint: "contraste forte nos dois temas" },
  { value: "color", label: "Colorida", hint: "na cor de destaque" },
];

export type Appearance = { accent: Accent; sidebar: SidebarStyle };
export const DEFAULT_APPEARANCE: Appearance = { accent: "orange", sidebar: "light" };
const KEY = "painel-aparencia";

/** Script inline do <head>: lê a última escolha e marca o <html> antes de pintar. */
export const APPEARANCE_BOOT_SCRIPT = `try{var a=JSON.parse(localStorage.getItem("${KEY}")||"{}");var d=document.documentElement;if(a.accent)d.dataset.accent=a.accent;if(a.sidebar)d.dataset.sidebar=a.sidebar}catch(e){}`;

const listeners = new Set<() => void>();
let current: Appearance = DEFAULT_APPEARANCE;
let booted = false;

function readDom(): Appearance {
  const d = document.documentElement.dataset;
  return {
    accent: (d.accent as Accent) || DEFAULT_APPEARANCE.accent,
    sidebar: (d.sidebar as SidebarStyle) || DEFAULT_APPEARANCE.sidebar,
  };
}

/** Aplica no <html>, lembra no navegador e avisa quem estiver ouvindo. */
export function applyAppearance(next: Partial<Appearance>) {
  if (typeof document === "undefined") return;
  current = { ...getAppearance(), ...next };
  const d = document.documentElement.dataset;
  d.accent = current.accent;
  d.sidebar = current.sidebar;
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* modo privado: só a sessão */ }
  listeners.forEach((l) => l());
}

export function getAppearance(): Appearance {
  if (typeof document === "undefined") return DEFAULT_APPEARANCE;
  if (!booted) { current = readDom(); booted = true; }
  return current;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

/** Leitura reativa (a barra lateral troca de pele na hora em que a pessoa escolhe). */
export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, getAppearance, () => DEFAULT_APPEARANCE);
}
