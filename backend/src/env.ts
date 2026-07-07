// Carrega e valida variáveis de ambiente com zod (falha cedo se algo faltar).
import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES: z.string().default("15m"),
  REFRESH_EXPIRES_DAYS: z.coerce.number().default(14),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
});
export const env = schema.parse(process.env);
