// v12 — configurações da instância editáveis em runtime (cadastro público, domínios permitidos
// e faixa de aviso). Registrado SEM prefixo: caminhos completos, como em announcements.
import type { FastifyInstance } from "fastify";
import { getSettings, settingsPatchSchema, storedKeys, updateSettings } from "../../lib/settings.js";
import { audit } from "../../lib/audit.js";
import { stripUndefined } from "../../lib/strip.js";

export async function settingsRoutes(app: FastifyInstance) {
  // Público: a tela de cadastro precisa saber se está aberta e para quais domínios, e a faixa
  // de aviso aparece também nas telas de entrada. Nada aqui é segredo.
  app.get("/settings/public", async () => {
    const s = await getSettings(app.prisma);
    return { registrationOpen: s.registrationOpen, registrationDomains: s.registrationDomains, banner: s.banner };
  });

  app.get("/admin/settings", { preHandler: app.requireAdmin }, async () => ({
    settings: await getSettings(app.prisma),
    stored: await storedKeys(app.prisma),
  }));

  app.patch("/admin/settings", { preHandler: app.requireAdmin }, async (req) => {
    const patch = stripUndefined(settingsPatchSchema.parse(req.body));
    const settings = await updateSettings(app.prisma, patch, req.user.sub);
    await audit(app.prisma, {
      userId: req.user.sub, action: "settings.update", entity: "InstanceSetting",
      meta: patch, ip: req.ip,
    });
    return { settings, stored: await storedKeys(app.prisma) };
  });
}
