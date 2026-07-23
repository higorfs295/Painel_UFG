"use client";

// Admin · Configurações da instância: estado do SMTP (com envio de teste), parâmetros de
// cadastro/convite e as ferramentas de desenvolvimento (só com DEV_TOOLS ligado).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { admin, courses } from "@/lib/api/endpoints";
import { Badge, Card, Chip, Field, PageHead, Section, inputCls } from "@/components/ui";
import Button from "@/components/ui/button";
import { IconMail, IconSend, IconServer, IconSprout } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export default function AdminConfigPage() {
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useQuery({ queryKey: ["admin-config"], queryFn: admin.config });
  const { data: courseList } = useQuery({ queryKey: ["courses"], queryFn: courses.list });
  const [seed, setSeed] = useState({ count: 10, courseSlug: "" });

  const afterDev = () => {
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const test = useMutation({
    mutationFn: () => admin.testMail(),
    onSuccess: (r) => r.sent ? toast.success(`E-mail de teste enviado para ${r.to}.`) : toast.error(r.error ?? "Falha ao enviar."),
    onError: () => toast.error("Falha ao enviar (SMTP não configurado?)."),
  });
  const gen = useMutation({
    mutationFn: () => admin.seedStudents({ count: seed.count, courseSlug: seed.courseSlug }),
    onSuccess: (r) => { afterDev(); toast.success(`${r.created} aluno(s) criado(s). Senha de todos: ${r.password}`, { duration: 8000 }); },
    onError: () => toast.error("Falha ao gerar alunos."),
  });
  const genAvisos = useMutation({
    mutationFn: () => admin.seedAnnouncements(),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["announcements-admin"] }); toast.success(`${r.created} aviso(s) de exemplo criado(s).`); },
    onError: () => toast.error("Falha ao gerar avisos."),
  });
  const purge = useMutation({
    mutationFn: () => admin.purgeDevStudents(),
    onSuccess: (r) => { afterDev(); toast.success(`${r.removed} conta(s) de demonstração removida(s).`); },
    onError: () => toast.error("Falha ao limpar."),
  });

  if (isLoading || !cfg) {
    return (
      <div className="flex flex-col gap-5">
        <div className="skeleton h-16 w-72" />
        <div className="skeleton h-56" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="administração · instância" title="Configurações" />

      <Section title="E-mail (SMTP)">
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone={cfg.mail.configured ? "done" : "lock"}>
            {cfg.mail.configured ? "SMTP configurado" : "SMTP não configurado"}
          </Chip>
          <span className="text-muted-foreground text-sm">
            {cfg.mail.configured
              ? "convites e redefinições de senha são enviados por e-mail"
              : "os links de convite/redefinição ficam no log e são repassados manualmente"}
          </span>
        </div>

        <dl className="text-muted-foreground mt-4 grid gap-2 text-sm sm:grid-cols-[140px_1fr]">
          <dt>Servidor</dt><dd className="text-foreground">{cfg.mail.host ? `${cfg.mail.host}:${cfg.mail.port}` : "—"}</dd>
          <dt>Usuário</dt><dd className="text-foreground">{cfg.mail.user ?? "—"}</dd>
          <dt>Remetente</dt><dd className="text-foreground">{cfg.mail.from}</dd>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={!cfg.mail.configured || test.isPending} onClick={() => test.mutate()}>
            <IconSend /> {test.isPending ? "Enviando…" : "Enviar e-mail de teste"}
          </Button>
          {!cfg.mail.configured && (
            <span className="text-muted-foreground text-sm">
              defina <code>SMTP_HOST</code> no ambiente para habilitar
            </span>
          )}
        </div>
      </Section>

      <Section title="Instância">
        <dl className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
          <dt>Cadastro público</dt>
          <dd>
            <Chip tone={cfg.registration.allowed ? "done" : "lock"}>
              {cfg.registration.allowed ? "habilitado" : "desabilitado"}
            </Chip>
            <span className="text-subtle-foreground ml-2 text-xs">definido por <code>ALLOW_REGISTRATION</code></span>
          </dd>
          <dt>Validade do convite</dt><dd className="text-foreground">{cfg.invite.expiresHours} h</dd>
          <dt>URL da aplicação</dt><dd className="text-foreground break-all">{cfg.appUrl}</dd>
          <dt>Ambiente</dt><dd><Badge>{cfg.env}</Badge></dd>
          <dt>Ferramentas de dev</dt>
          <dd><Chip tone={cfg.devTools ? "avail" : "lock"}>{cfg.devTools ? "ligadas" : "desligadas"}</Chip></dd>
        </dl>
      </Section>

      {cfg.devTools && (
        <Section title="Ferramentas de desenvolvimento"
          hint="só aparecem com DEV_TOOLS=true fora de produção — criam e removem dados de demonstração">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Quantidade" className="w-28">
              <input type="number" min={1} max={200} value={seed.count}
                onChange={(e) => setSeed({ ...seed, count: Number(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Curso" className="min-w-[220px] flex-1">
              <select value={seed.courseSlug} onChange={(e) => setSeed({ ...seed, courseSlug: e.target.value })}
                className={inputCls}>
                <option value="">— selecione —</option>
                {courseList?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </Field>
            <Button disabled={!seed.courseSlug || gen.isPending} onClick={() => gen.mutate()}>
              <IconSprout /> {gen.isPending ? "Gerando…" : "Gerar alunos"}
            </Button>
            <Button disabled={genAvisos.isPending} onClick={() => genAvisos.mutate()}>
              <IconMail /> Gerar avisos
            </Button>
            <Button variant="danger" disabled={purge.isPending} onClick={() => purge.mutate()}>
              <IconServer /> Limpar demonstração
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}
