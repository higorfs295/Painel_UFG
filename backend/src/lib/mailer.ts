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
      secure: env.SMTP_PORT === 465, // 465 = TLS implícito; 587 = STARTTLS
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
    });
  }
  return transporter;
}

const TEMPLATES = {
  SET_PASSWORD: {
    subject: "Convite — Painel Acadêmico",
    text: (link: string) =>
      `Você foi convidado(a) para o Painel Acadêmico.\n\n` +
      `Defina sua senha pelo link (expira em ${env.INVITE_EXPIRES_HOURS}h):\n${link}\n\n` +
      `Se você não esperava este convite, ignore este e-mail.`,
  },
  RESET_PASSWORD: {
    subject: "Redefinição de senha — Painel Acadêmico",
    text: (link: string) =>
      `Recebemos um pedido de redefinição de senha da sua conta.\n\n` +
      `Redefina pelo link (expira em ${env.INVITE_EXPIRES_HOURS}h):\n${link}\n\n` +
      `Se não foi você, ignore este e-mail — sua senha continua a mesma.`,
  },
} as const;

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
    await t.sendMail({ from: env.MAIL_FROM, to, subject: tpl.subject, text: tpl.text(link) });
    log.info({ to }, `e-mail de ${purpose} enviado`);
    return true;
  } catch (err) {
    log.warn({ err, to }, `falha ao enviar e-mail de ${purpose} — use o link manualmente`);
    return false;
  }
}
