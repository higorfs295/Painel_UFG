// Admin · Configurações do sistema: estado do e-mail (SMTP), cadastro público e dados da
// instância. As configurações vêm do ambiente (somente leitura); o e-mail pode ser testado.
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { admin } from "../../api/endpoints";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { IconMail, IconServer, IconSend } from "../../components/ui/Icons";

export default function AdminConfigPage() {
  const { data: cfg, isLoading } = useQuery({ queryKey: ["admin-config"], queryFn: admin.config });
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const test = useMutation({
    mutationFn: () => admin.testMail(),
    onSuccess: (r) => setMsg(r.sent ? { ok: `E-mail de teste enviado para ${r.to}.` } : { err: r.error ?? "Falha ao enviar." }),
    onError: (e) => setMsg({ err: e instanceof Error ? e.message : "Falha ao enviar (SMTP não configurado?)." }),
  });

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">administração · instância</span>
        <h1>Configu<em>rações</em></h1>
      </header>

      {isLoading || !cfg ? <div className="spinner" role="status">Carregando…</div> : (
        <>
          <Card>
            <h3><IconMail /> E-mail (SMTP)</h3>
            <div className="row wrap" style={{ gap: 10, alignItems: "center", marginBottom: 4 }}>
              {cfg.mail.configured
                ? <span className="chip done"><span className="swatch" />SMTP configurado</span>
                : <span className="chip lock"><span className="swatch" />SMTP não configurado</span>}
              <span className="mut" style={{ fontSize: ".85rem" }}>
                {cfg.mail.configured
                  ? "convites e redefinições de senha são enviados por e-mail"
                  : "os links de convite/redefinição ficam no log e são repassados manualmente"}
              </span>
            </div>
            <div className="tablewrap mt">
              <table>
                <tbody>
                  <tr><td className="mut">Servidor</td><td>{cfg.mail.host ? `${cfg.mail.host}:${cfg.mail.port}` : "—"}</td></tr>
                  <tr><td className="mut">Usuário</td><td>{cfg.mail.user ?? "—"}</td></tr>
                  <tr><td className="mut">Remetente</td><td>{cfg.mail.from}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="row mt" style={{ gap: 8, alignItems: "center" }}>
              <Button variant="prim" disabled={!cfg.mail.configured || test.isPending} onClick={() => { setMsg({}); test.mutate(); }}>
                <IconSend /> {test.isPending ? "Enviando…" : "Enviar e-mail de teste"}
              </Button>
              {!cfg.mail.configured && <span className="mut" style={{ fontSize: ".82rem" }}>defina <code>SMTP_HOST</code> no ambiente para habilitar</span>}
            </div>
            {msg.ok && <div className="ok mt">{msg.ok}</div>}
            {msg.err && <div className="err mt" role="alert">{msg.err}</div>}
            <p className="mut mt" style={{ fontSize: ".82rem" }}>
              Para habilitar: configure <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>,
              <code>SMTP_PASS</code> e <code>MAIL_FROM</code> (ex.: Gmail com senha de app, Resend, Brevo, Mailtrap).
            </p>
          </Card>

          <Card>
            <h3><IconServer /> Instância</h3>
            <div className="tablewrap">
              <table>
                <tbody>
                  <tr>
                    <td className="mut">Cadastro público</td>
                    <td>{cfg.registration.allowed
                      ? <span className="chip done"><span className="swatch" />habilitado</span>
                      : <span className="chip lock"><span className="swatch" />desabilitado</span>}
                      <span className="mut" style={{ marginLeft: 8, fontSize: ".82rem" }}>(<code>ALLOW_REGISTRATION</code>)</span>
                    </td>
                  </tr>
                  <tr><td className="mut">Validade do convite</td><td>{cfg.invite.expiresHours}h</td></tr>
                  <tr><td className="mut">URL do painel</td><td><code>{cfg.appUrl}</code></td></tr>
                </tbody>
              </table>
            </div>
            <p className="mut mt" style={{ fontSize: ".82rem" }}>Estas opções vêm do ambiente do servidor (somente leitura por aqui).</p>
          </Card>
        </>
      )}
    </div>
  );
}
