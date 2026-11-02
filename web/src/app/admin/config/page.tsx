"use client";

// Admin · Configurações (v12): o que antes só mudava com redeploy agora muda aqui — cadastro
// público aberto ou fechado, domínios de e-mail aceitos e a faixa de aviso no topo de todas as
// telas. O resto (SMTP, URL, ambiente) continua vindo do ambiente e aparece só para leitura.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  RiCloseLine, RiDoorOpenLine, RiFlaskLine, RiInformationLine, RiMailLine, RiMegaphoneLine, RiServerLine, RiSendPlaneLine,
} from "@remixicon/react";
import { admin, courses } from "@/lib/api/endpoints";
import { PageBanner } from "@/components/fx/page-banner";
import { Panel, Pill } from "@/components/admin/panel";
import { InstanceBanner } from "@/components/layout/instance-banner";
import { Button } from "@/components/tremor/Button";
import { Input } from "@/components/tremor/Input";
import { Label } from "@/components/tremor/Label";
import { Switch } from "@/components/tremor/Switch";
import { Textarea } from "@/components/tremor/Textarea";
import { Segmented, selectCls } from "@/components/ui";
import type { Banner } from "@/lib/api/types";

const TONES = [{ v: "info", label: "Informação" }, { v: "warning", label: "Atenção" }, { v: "success", label: "Boa notícia" }] as const;

export default function AdminConfigPage() {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({ queryKey: ["admin-config"], queryFn: admin.config });
  const { data: st } = useQuery({ queryKey: ["admin-settings"], queryFn: admin.settings });
  const { data: courseList } = useQuery({ queryKey: ["courses"], queryFn: courses.list });

  const [open, setOpen] = useState(true);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainDraft, setDomainDraft] = useState("");
  const [bannerOn, setBannerOn] = useState(false);
  const [banner, setBanner] = useState<Banner>({ message: "", tone: "info" });
  const [seed, setSeed] = useState({ count: 10, courseSlug: "" });

  useEffect(() => {
    if (!st) return;
    setOpen(st.settings.registrationOpen);
    setDomains(st.settings.registrationDomains);
    setBannerOn(!!st.settings.banner);
    setBanner(st.settings.banner ?? { message: "", tone: "info" });
  }, [st]);

  const afterSave = () => {
    for (const k of [["admin-settings"], ["admin-config"], ["public-settings"]]) qc.invalidateQueries({ queryKey: k });
  };
  const saveReg = useMutation({
    mutationFn: () => admin.updateSettings({ registrationOpen: open, registrationDomains: domains }),
    onSuccess: () => { afterSave(); toast.success("Cadastro atualizado."); },
    onError: () => toast.error("Confira os domínios (ex.: ufg.br)."),
  });
  const saveBanner = useMutation({
    mutationFn: () => admin.updateSettings({ banner: bannerOn && banner.message.trim() ? { ...banner, message: banner.message.trim() } : null }),
    onSuccess: () => { afterSave(); toast.success(bannerOn ? "Faixa publicada." : "Faixa desligada."); },
    onError: () => toast.error("A mensagem precisa ter entre 1 e 280 caracteres."),
  });
  const test = useMutation({
    mutationFn: () => admin.testMail(),
    onSuccess: (r) => r.sent ? toast.success(`E-mail de teste enviado para ${r.to}.`) : toast.error(r.error ?? "Falha ao enviar."),
    onError: () => toast.error("Falha ao enviar (SMTP não configurado?)."),
  });
  const afterDev = () => { for (const k of [["admin-analytics"], ["admin-users"], ["admin-announcements"]]) qc.invalidateQueries({ queryKey: k }); };
  const gen = useMutation({
    mutationFn: () => admin.seedStudents({ count: seed.count, courseSlug: seed.courseSlug }),
    onSuccess: (r) => { afterDev(); toast.success(`${r.created} aluno(s) criado(s). Senha de todos: ${r.password}`, { duration: 8000 }); },
    onError: () => toast.error("Falha ao gerar alunos."),
  });
  const genAvisos = useMutation({ mutationFn: () => admin.seedAnnouncements(), onSuccess: (r) => { afterDev(); toast.success(`${r.created} aviso(s) de exemplo criado(s).`); } });
  const purge = useMutation({ mutationFn: () => admin.purgeDevStudents(), onSuccess: (r) => { afterDev(); toast.success(`${r.removed} conta(s) de demonstração removida(s).`); } });

  function addDomain() {
    const d = domainDraft.trim().toLowerCase().replace(/^@/, "");
    if (!d) return;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) { toast.error("Domínio inválido (ex.: discente.ufg.br)."); return; }
    if (!domains.includes(d)) setDomains([...domains, d]);
    setDomainDraft("");
  }

  const regSource = st?.stored.includes("registrationOpen") ? "definido aqui" : "padrão do ambiente (ALLOW_REGISTRATION)";

  return (
    <div className="flex flex-col gap-6">
      <PageBanner eyebrow="Operação" icon={RiServerLine} title="Configurações" tone="violet"
        description="Decisões da instância que valem na hora, para todo mundo — sem redeploy. Cada mudança entra na trilha de auditoria." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel icon={RiDoorOpenLine} tone="emerald" id="cadastro" title="Cadastro público" description={st ? regSource : "carregando…"}>
          {!st ? <div className="skeleton h-40" /> : (
            <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); saveReg.mutate(); }}>
              <label className="flex items-start gap-3">
                <Switch checked={open} onCheckedChange={setOpen} aria-label="Permitir cadastro público" className="mt-0.5" />
                <span className="text-sm">
                  <span className="block font-medium text-gray-900 dark:text-gray-50">{open ? "Qualquer pessoa pode criar conta" : "Só por convite"}</span>
                  <span className="text-gray-500 dark:text-gray-400">{open ? "A tela Cadastrar fica disponível." : "A tela Cadastrar recusa novas contas; convites continuam funcionando."}</span>
                </span>
              </label>
              <div>
                <Label htmlFor="dominio">Domínios de e-mail aceitos</Label>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Vazio = qualquer e-mail. Subdomínios entram junto (ufg.br aceita discente.ufg.br).</p>
                <div className="mt-2 flex gap-2">
                  <Input id="dominio" placeholder="ex.: discente.ufg.br" value={domainDraft} disabled={!open}
                    onChange={(e) => setDomainDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDomain(); } }} />
                  <Button type="button" variant="secondary" disabled={!open} onClick={addDomain}>Adicionar</Button>
                </div>
                {domains.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {domains.map((d) => (
                      <li key={d} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 py-0.5 pr-1 pl-2.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-600/25 ring-inset dark:bg-emerald-400/10 dark:text-emerald-300">
                        @{d}
                        <button type="button" aria-label={`Remover ${d}`} onClick={() => setDomains(domains.filter((x) => x !== d))} className="rounded-full p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-400/20">
                          <RiCloseLine className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button type="submit" className="w-fit" isLoading={saveReg.isPending}>Salvar cadastro</Button>
            </form>
          )}
        </Panel>

        <Panel icon={RiMegaphoneLine} tone="amber" id="faixa" title="Faixa de aviso" description="aparece no topo de todas as telas logadas">
          {!st ? <div className="skeleton h-40" /> : (
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); saveBanner.mutate(); }}>
              <label className="flex items-center gap-3 text-sm font-medium text-gray-900 dark:text-gray-50">
                <Switch checked={bannerOn} onCheckedChange={setBannerOn} aria-label="Mostrar faixa de aviso" />
                {bannerOn ? "Faixa ligada" : "Faixa desligada"}
              </label>
              <div>
                <Label htmlFor="faixa-texto">Mensagem</Label>
                <Textarea id="faixa-texto" className="mt-2" rows={2} maxLength={280} disabled={!bannerOn} value={banner.message}
                  placeholder="ex.: Manutenção hoje às 22h — o painel fica fora por ~10 minutos."
                  onChange={(e) => setBanner({ ...banner, message: e.target.value })} />
                <p className="mt-1 text-right text-xs text-gray-500">{banner.message.length}/280</p>
              </div>
              <Segmented label="Tom da faixa" value={banner.tone} onChange={(v) => setBanner({ ...banner, tone: v })} options={[...TONES]} />
              {bannerOn && banner.message.trim() && (
                <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-800" aria-label="Prévia da faixa">
                  <BannerPreview banner={banner} />
                </div>
              )}
              <Button type="submit" className="w-fit" isLoading={saveBanner.isPending}>{bannerOn ? "Publicar faixa" : "Salvar"}</Button>
            </form>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel icon={RiMailLine} tone="blue" id="smtp" title="E-mail (SMTP)" description="vem do ambiente">
          {!cfg ? <div className="skeleton h-32" /> : (<>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={cfg.mail.configured ? "emerald" : "gray"}>{cfg.mail.configured ? "configurado" : "não configurado"}</Pill>
              <span className="text-sm text-gray-500 dark:text-gray-400">{cfg.mail.configured ? "convites e redefinições vão por e-mail" : "os links aparecem na tela para repasse manual"}</span>
            </div>
            <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-sm">
              <dt className="text-gray-500 dark:text-gray-400">Servidor</dt><dd className="text-gray-900 dark:text-gray-50">{cfg.mail.host ? `${cfg.mail.host}:${cfg.mail.port}` : "—"}</dd>
              <dt className="text-gray-500 dark:text-gray-400">Usuário</dt><dd className="text-gray-900 dark:text-gray-50">{cfg.mail.user ?? "—"}</dd>
              <dt className="text-gray-500 dark:text-gray-400">Remetente</dt><dd className="text-gray-900 dark:text-gray-50">{cfg.mail.from}</dd>
            </dl>
            <Button className="mt-4" variant="secondary" disabled={!cfg.mail.configured} isLoading={test.isPending} onClick={() => test.mutate()}>
              <RiSendPlaneLine className="mr-1.5 size-4" aria-hidden="true" />Enviar e-mail de teste para mim
            </Button>
          </>)}
        </Panel>
        <Panel icon={RiInformationLine} tone="gray" id="instancia" title="Instância" description="somente leitura">
          {!cfg ? <div className="skeleton h-32" /> : (
            <dl className="grid grid-cols-[150px_1fr] gap-y-2.5 text-sm">
              <dt className="text-gray-500 dark:text-gray-400">Ambiente</dt><dd><Pill tone={cfg.env === "production" ? "emerald" : "amber"}>{cfg.env}</Pill></dd>
              <dt className="text-gray-500 dark:text-gray-400">URL da aplicação</dt><dd className="break-all text-gray-900 dark:text-gray-50">{cfg.appUrl}</dd>
              <dt className="text-gray-500 dark:text-gray-400">Validade do convite</dt><dd className="text-gray-900 dark:text-gray-50">{cfg.invite.expiresHours} h</dd>
              <dt className="text-gray-500 dark:text-gray-400">Cadastro (ambiente)</dt><dd className="text-gray-900 dark:text-gray-50">{cfg.registration.envDefault ? "aberto" : "fechado"} <span className="text-xs text-gray-500">— vale enquanto ninguém salvar acima</span></dd>
              <dt className="text-gray-500 dark:text-gray-400">Ferramentas de dev</dt><dd><Pill tone={cfg.devTools ? "amber" : "gray"}>{cfg.devTools ? "ligadas" : "desligadas"}</Pill></dd>
            </dl>
          )}
        </Panel>
      </div>

      {cfg?.devTools && (
        <Panel icon={RiFlaskLine} tone="pink" id="dev" title="Ferramentas de desenvolvimento" description="só com DEV_TOOLS=true fora de produção — criam e removem dados de demonstração">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-28"><Label htmlFor="dev-qtd">Quantidade</Label>
              <Input id="dev-qtd" type="number" min={1} max={200} className="mt-2" value={seed.count} onChange={(e) => setSeed({ ...seed, count: Number(e.target.value) })} /></div>
            <div className="min-w-56 flex-1"><Label htmlFor="dev-curso">Curso</Label>
              <select id="dev-curso" className={`${selectCls} mt-2`} value={seed.courseSlug} onChange={(e) => setSeed({ ...seed, courseSlug: e.target.value })}>
                <option value="">— selecione —</option>
                {courseList?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select></div>
            <Button disabled={!seed.courseSlug} isLoading={gen.isPending} onClick={() => gen.mutate()}>Gerar alunos</Button>
            <Button variant="secondary" isLoading={genAvisos.isPending} onClick={() => genAvisos.mutate()}>Gerar avisos</Button>
            <Button variant="destructive" isLoading={purge.isPending} onClick={() => purge.mutate()}>Limpar demonstração</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

/** Prévia: a mesma faixa que as telas mostram, com a mensagem ainda não salva. */
function BannerPreview({ banner }: { banner: Banner }) {
  return <InstanceBanner preview={banner} className="border-b-0" />;
}
