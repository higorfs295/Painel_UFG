// Carrega e valida variáveis de ambiente com zod (falha cedo se algo faltar).
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES: z.string().default("15m"),
  REFRESH_EXPIRES_DAYS: z.coerce.number().default(14),
  INVITE_EXPIRES_HOURS: z.coerce.number().default(72),
  APP_URL: z.string().url().default("http://localhost:5173"), // base dos links de convite/reset
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  REDIS_URL: z.string().url().optional(), // se definido, store distribuído do rate limit (réplicas)
});
export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
