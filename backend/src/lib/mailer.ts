// RF-18 — envio de e-mail (convite/reset). Opcional: sem SMTP_HOST configurado, o sistema
// funciona no modo manual (o link é logado e devolvido ao admin para repasse).
// SMTP grátis para uso pessoal: Gmail com "senha de app", Resend, Brevo, Mailtrap etc.
import { env, mailerConfigured } from "../env.js";
import type { FastifyBaseLogger } from "fastify";

type Transporter = import("nodemailer").Transporter;
let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter | null> {
  if (!mailerConfigured) return null;
  if (!transporter) {
    const { default: nodemailer } = await import("nodemailer");
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // 465 = TLS implícito; 587/2525 = STARTTLS
      // Sem isto o STARTTLS é oportunista: um servidor que não anuncia a extensão faria
      // a sessão seguir em texto claro. Com requireTLS a conexão falha em vez de degradar.
      requireTLS: env.SMTP_PORT !== 465,
      // O padrão do nodemailer é 2 MINUTOS para conectar. Se a porta estiver bloqueada
      // (o free do Render bloqueia 25/465/587), o POST /users ficaria pendurado esse tempo
      // todo antes de responder. Falhar rápido e cair no modo manual é melhor.
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 15_000,
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
    });
  }
  return transporter;
}

const TEMPLATES = {
  SET_PASSWORD: {
    subject: "Convite — Painel Acadêmico",
    lead: "Você foi convidado(a) para o Painel Acadêmico.",
    cta: "Definir minha senha",
    foot: "Se você não esperava este convite, ignore este e-mail.",
    text: (link: string) =>
      `Você foi convidado(a) para o Painel Acadêmico.\n\n` +
      `Defina sua senha pelo link (expira em ${env.INVITE_EXPIRES_HOURS}h):\n${link}\n\n` +
      `Se você não esperava este convite, ignore este e-mail.`,
  },
  RESET_PASSWORD: {
    subject: "Redefinição de senha — Painel Acadêmico",
    lead: "Recebemos um pedido de redefinição de senha da sua conta.",
    cta: "Redefinir minha senha",
    foot: "Se não foi você, ignore este e-mail — sua senha continua a mesma.",
    text: (link: string) =>
      `Recebemos um pedido de redefinição de senha da sua conta.\n\n` +
      `Redefina pelo link (expira em ${env.INVITE_EXPIRES_HOURS}h):\n${link}\n\n` +
      `Se não foi você, ignore este e-mail — sua senha continua a mesma.`,
  },
} as const;

// Layout HTML simples e com a marca (pôr-do-sol do cerrado), inline-CSS p/ clientes de e-mail.
function htmlShell(lead: string, cta: string, link: string, foot: string): string {
  return `<!doctype html><html><body style="margin:0;background:#151009;padding:28px 0;font-family:Segoe UI,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;background:#221812;border:1px solid #3B2C22;border-radius:20px;overflow:hidden">
      <tr><td style="height:6px;background:linear-gradient(90deg,#8C63B0,#D25440,#DB6B33,#F0A83C)"></td></tr>
      <tr><td style="padding:30px 32px 8px">
        <div style="font-size:17px;font-weight:700;color:#F5EADB">Painel Acadêmico</div>
        <p style="color:#C0A68E;font-size:15px;line-height:1.6;margin:16px 0 22px">${lead}</p>
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#F0A83C,#DB6B33);color:#1B1109;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px">${cta}</a>
        <p style="color:#8B715C;font-size:12px;line-height:1.6;margin:22px 0 0">O link expira em ${env.INVITE_EXPIRES_HOURS}h. Se o botão não funcionar, copie e cole:<br><span style="color:#C0A68E;word-break:break-all">${link}</span></p>
      </td></tr>
      <tr><td style="padding:16px 32px 26px;border-top:1px solid #3B2C22"><p style="color:#8B715C;font-size:12px;margin:12px 0 0">${foot}</p></td></tr>
    </table>
  </td></tr></table></body></html>`;
}

// Envia o e-mail de convite/reset. Nunca lança: falha de SMTP não pode quebrar o fluxo
// (o link continua disponível para repasse manual). Retorna se foi enviado.
export async function sendInviteEmail(
  log: FastifyBaseLogger,
  to: string,
  link: string,
  purpose: keyof typeof TEMPLATES,
): Promise<boolean> {
  const t = await getTransporter();
  if (!t) {
    log.info({ to, link }, `SMTP não configurado — repasse o link de ${purpose} manualmente`);
    return false;
  }
  try {
    const tpl = TEMPLATES[purpose];
    await t.sendMail({
      from: env.MAIL_FROM, to, subject: tpl.subject,
      text: tpl.text(link), html: htmlShell(tpl.lead, tpl.cta, link, tpl.foot),
    });
    log.info({ to }, `e-mail de ${purpose} enviado`);
    return true;
  } catch (err) {
    log.warn({ err, to }, `falha ao enviar e-mail de ${purpose} — use o link manualmente`);
    return false;
  }
}

// Envio de teste (usado pelo admin para validar o SMTP). Lança em caso de erro para a rota
// devolver o motivo — diferente do fluxo de convite, aqui o admin QUER saber se falhou.
export async function sendTestEmail(to: string): Promise<void> {
  const t = await getTransporter();
  if (!t) throw new Error("SMTP não configurado (defina SMTP_HOST).");
  await t.sendMail({
    from: env.MAIL_FROM, to,
    subject: "Teste de e-mail — Painel Acadêmico",
    text: "Este é um e-mail de teste do Painel Acadêmico. Se você recebeu, o SMTP está funcionando. ✅",
    html: htmlShell("Este é um e-mail de teste do Painel Acadêmico.", "Abrir o painel",
      env.APP_URL, "Se você recebeu esta mensagem, o SMTP da instância está funcionando. ✅"),
  });
}
