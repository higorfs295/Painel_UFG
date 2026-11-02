// Preferências de aparência por usuário (RF-15 ampliado na v12). Ficam numa lista só porque a
// rota de ajustes, o backup e os testes precisam concordar sobre os valores aceitos.
//
// As cores são nomes de paletas do Tailwind; o frontend mapeia cada uma para a sua escala
// (web/src/app/globals.css, `[data-accent=…]`). Só entram paletas cujo tom 700 passa no WCAG AA
// com texto branco — a tabela de contraste está em docs/DESIGN.md.
import { z } from "zod";

export const THEMES = ["dark", "light", "system"] as const;
export const ACCENTS = ["orange", "blue", "violet", "emerald", "rose"] as const;
export const SIDEBARS = ["light", "dark", "color"] as const;

export const themeSchema = z.enum(THEMES);
export const accentSchema = z.enum(ACCENTS);
export const sidebarSchema = z.enum(SIDEBARS);

export type Theme = (typeof THEMES)[number];
export type Accent = (typeof ACCENTS)[number];
export type Sidebar = (typeof SIDEBARS)[number];
