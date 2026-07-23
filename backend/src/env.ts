// Carrega e valida variáveis de ambiente com zod (falha cedo se algo faltar).
import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES: z.string().default("15m"),
  REFRESH_EXPIRES_DAYS: z.coerce.number().default(14),
  INVITE_EXPIRES_HOURS: z.coerce.number().default(72),
  APP_URL: z.string().url().default("http://localhost:5173"), // base dos links de convite/reset
  // uma origem ou lista separada por vírgula (ex.: produção + previews da Vercel)
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  // Teto das rotas de segredo (login, convite, redefinição) — bem mais baixo que o geral.
  // Configurável porque a suíte E2E, rodando de um único IP, estoura 10/min sozinha; em
  // produção o padrão vale e não deve ser afrouxado.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  REDIS_URL: z.string().url().optional(), // se definido, store distribuído do rate limit (réplicas)

  // Cadastro público (RF-17). "false" desliga o POST /auth/register (instâncias fechadas).
  ALLOW_REGISTRATION: z.enum(["true", "false"]).default("true"),

  // Cookies de refresh em deploy cross-site (frontend Vercel + API Render): use "none".
  // Mesma origem (Caddy) ou localhost: "lax". "none" força Secure (exigência dos navegadores).
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),

  // Atrás de proxy/CDN (Render, Caddy, nginx): mantém req.ip real p/ rate limit e logs.
  TRUST_PROXY: z.enum(["true", "false"]).default("true"),

  // Namespace duplo: além da raiz, a API responde também sob este prefixo (ex.: /api/auth).
  // Necessário quando frontend e API dividem a MESMA origem (docker-compose atrás do Caddy):
  // as páginas do Next em /admin/* colidem com os endpoints em /admin/*. Em deploy
  // cross-origin (Vercel + Render) o alias é dispensável — use "" para desligar.
  API_ALIAS_PREFIX: z.string().default("/api")
    .refine((v) => v === "" || /^\/[a-z0-9-]+$/.test(v), {
      message: 'API_ALIAS_PREFIX deve ser vazio ou um segmento como "/api"',
    }),

  // E-mail (RF-18) — opcional: sem SMTP_HOST o sistema só registra o link no log e o devolve
  // ao admin (fluxo manual). Com SMTP configurado, convites/resets são enviados de verdade.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Painel Acadêmico <no-reply@painel.local>"),

  // Ferramentas de desenvolvimento (gerador de alunos fictícios etc.). NUNCA ligue em produção:
  // além da flag, o endpoint também recusa quando NODE_ENV === "production".
  DEV_TOOLS: z.enum(["true", "false"]).default("false"),

  // Documentação OpenAPI em /docs. Fora de produção por padrão (expõe a superfície da API).
  DOCS_ENABLED: z.enum(["true", "false"]).default("true"),

  // Camada extra de criptografia: cifra de campo (AES-256-GCM) para PII em repouso —
  // hoje o nº de matrícula. 32 bytes em base64 ou hex. Ausente = grava em claro (modo
  // transparente, retrocompatível). Gere com:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  FIELD_ENCRYPTION_KEY: z.string().optional(),
});
export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
export const corsOrigins = env.CORS_ORIGIN.split(",").map(s => s.trim()).filter(Boolean);
export const allowRegistration = env.ALLOW_REGISTRATION === "true";
export const mailerConfigured = Boolean(env.SMTP_HOST);

// Prefixo do namespace alias ("" = desligado). Ver app.ts.
export const API_ALIAS_PREFIX = env.API_ALIAS_PREFIX;
export const devToolsEnabled = env.DEV_TOOLS === "true" && !isProd;
export const docsEnabled = env.DOCS_ENABLED === "true" && !isProd;
