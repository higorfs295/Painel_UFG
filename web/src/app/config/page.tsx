"use client";

// Ajustes da conta (RF-15/16) no layout de "Settings" do tremorlabs/template-dashboard:
// abas no topo (TabNavigation) e, em cada seção, título + descrição à esquerda e o
// formulário em 2/3 da largura à direita, separados por Divider.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import toast from "react-hot-toast";
import { RiComputerLine, RiMoonLine, RiSettings5Line, RiSunLine } from "@remixicon/react";
import { courses, me } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth-store";
import { reportError } from "@/lib/monitoring";
import { Badge } from "@/components/tremor/Badge";
import { Button } from "@/components/tremor/Button";
import { Divider } from "@/components/tremor/Divider";
import { Input } from "@/components/tremor/Input";
import { Label } from "@/components/tremor/Label";
import { TabNavigation, TabNavigationLink } from "@/components/tremor/TabNavigation";
import { selectCls } from "@/components/ui";
import { PageBanner } from "@/components/fx/page-banner";
import { AccentPicker, AppearancePreview, SidebarPicker } from "@/components/appearance-picker";
import { cx, fmtDate } from "@/lib/utils";
import type { Shift, Theme } from "@/lib/api/types";

const SHIFTS: { v: Shift; label: string }[] = [
  { v: "matutino", label: "Matutino" }, { v: "vespertino", label: "Vespertino" },
  { v: "noturno", label: "Noturno" }, { v: "integral", label: "Integral" },
];
const TERM_RE = /^\d{4}\.[12]$/;
type Tab = "geral" | "aparencia" | "seguranca" | "cursos";

/** Bloco de configuração: título/descrição à esquerda, conteúdo em 2/3 à direita. */
function Block({ id, title, desc, children }: { id: string; title: string; desc: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="grid grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3">
        <div>
          <h2 id={id} className="scroll-mt-10 font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{desc}</p>
        </div>
        <div className="md:col-span-2">{children}</div>
      </div>
    </section>
  );
}

const THEMES: { v: Theme; label: string; icon: typeof RiSunLine }[] = [
  { v: "light", label: "Claro", icon: RiSunLine },
  { v: "dark", label: "Escuro", icon: RiMoonLine },
  { v: "system", label: "Sistema", icon: RiComputerLine },
];

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const patchUser = useAuth((s) => s.patchUser);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function pick(t: Theme) {
    setTheme(t);
    patchUser({ theme: t });
    me.updateSettings({ theme: t }).then(() => toast.success("Tema salvo na sua conta.")).catch(reportError);
  }
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {THEMES.map(({ v, label, icon: Icon }) => {
        const on = mounted && theme === v;
        return (
          <button key={v} type="button" role="radio" aria-checked={on} onClick={() => pick(v)}
            className={cx(
              "flex cursor-pointer items-center gap-3 rounded-md border p-4 text-left text-sm shadow-xs transition",
              "outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2",
              on
                ? "border-brand-500 ring-1 ring-brand-500 dark:border-brand-500"
                : "border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900",
            )}>
            <Icon className={cx("size-5 shrink-0", on ? "text-brand-700 dark:text-brand-400" : "text-gray-500 dark:text-gray-400")} aria-hidden="true" />
            <span className="font-medium text-gray-900 dark:text-gray-50">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ConfigPage() {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const patchUser = useAuth((s) => s.patchUser);
  const isAdmin = user?.role === "ADMIN";
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("geral");
  const [name, setName] = useState(user?.name ?? "");
  const [acad, setAcad] = useState({ matricula: user?.matricula ?? "", shift: user?.shift ?? "" });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [newCourse, setNewCourse] = useState("");
  const [startEdit, setStartEdit] = useState<Record<string, string>>({});

  // /config#cursos (atalho do seletor de curso) abre direto na aba de cursos
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === "#cursos") setTab("cursos");
      else if (window.location.hash === "#aparencia") setTab("aparencia");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [isAdmin]);

  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: me.sessions });
  const { data: enrollments } = useQuery({ queryKey: ["enrollments"], queryFn: me.enrollments });
  const { data: courseList } = useQuery({ queryKey: ["courses"], queryFn: courses.list });

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const updated = await me.updateSettings({
        name,
        matricula: acad.matricula.trim() || null, shift: (acad.shift || null) as Shift | null,
      });
      patchUser({ name: updated.name, matricula: updated.matricula, shift: updated.shift });
      toast.success("Dados salvos.");
    } catch { toast.error("Falha ao salvar."); }
  }

  async function changePwd(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.next.length < 10) { toast.error("A nova senha precisa de ao menos 10 caracteres."); return; }
    if (pwd.next !== pwd.confirm) { toast.error("As senhas não coincidem."); return; }
    try {
      await me.changePassword(pwd.current, pwd.next);
      setPwd({ current: "", next: "", confirm: "" });
      toast.success("Senha alterada. Suas outras sessões foram encerradas.");
      qc.invalidateQueries({ queryKey: ["sessions"] });
    } catch { toast.error("Senha atual incorreta."); }
  }

  async function revokeOthers() {
    try {
      const res = await me.revokeOtherSessions();
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success(`${res.revoked} sessão(ões) encerrada(s).`);
    } catch { toast.error("Falha ao encerrar as sessões."); }
  }

  async function saveStartTerm(enrollmentId: string, current: string | null) {
    const value = (startEdit[enrollmentId] ?? current ?? "").trim();
    if (value && !TERM_RE.test(value)) { toast.error("Formato: AAAA.S (ex.: 2022.2)"); return; }
    try {
      await me.updateEnrollment(enrollmentId, { startTerm: value || null });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Ingresso salvo.");
    } catch { toast.error("Falha ao salvar."); }
  }

  async function addCourse() {
    if (!newCourse) return;
    try {
      await me.selfEnroll(newCourse);
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      setNewCourse("");
      toast.success("Matrícula criada.");
    } catch { toast.error("Não foi possível matricular."); }
  }

  async function doExport() {
    try {
      const data = await me.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `painel-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Falha ao exportar."); }
  }

  async function doImport(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      const res = await me.importBackup(parsed);
      qc.invalidateQueries();
      toast.success(
        `Backup restaurado: ${res.restored} matrícula(s).` +
        (res.skippedCourses.length ? ` Ignorados: ${res.skippedCourses.join(", ")}.` : ""),
      );
    } catch { toast.error("Arquivo inválido ou incompatível."); }
  }

  const tabs: { v: Tab; label: string }[] = [
    { v: "geral", label: "Geral" },
    { v: "aparencia", label: "Aparência" },
    { v: "seguranca", label: "Segurança" },
    { v: "cursos", label: isAdmin ? "Meus cursos" : "Cursos e backup" },
  ];

  return (
    <>
      <PageBanner eyebrow="Conta" icon={RiSettings5Line} title="Ajustes"
        description="Seus dados, a aparência do painel, segurança da conta e os cursos que você acompanha." />
      <TabNavigation className="mt-6">
        {tabs.map((t) => (
          <TabNavigationLink key={t.v} asChild active={tab === t.v}>
            <button type="button" onClick={() => setTab(t.v)}>{t.label}</button>
          </TabNavigationLink>
        ))}
      </TabNavigation>

      <div className="space-y-10 pt-6">
        {tab === "geral" && (
          <>
            <Block id="perfil" title="Informações pessoais"
              desc="Nome, número de matrícula e turno (opcionais para quem só administra). A matrícula é guardada cifrada no banco.">
              <form onSubmit={saveProfile} className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                <div className="col-span-full sm:col-span-3">
                  <Label htmlFor="nome" className="font-medium">Nome</Label>
                  <Input id="nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-2" />
                </div>
                <div className="col-span-full sm:col-span-3">
                  <Label htmlFor="email" className="font-medium">E-mail</Label>
                  <Input id="email" value={user?.email ?? ""} disabled className="mt-2" />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Papel: {isAdmin ? "administrador" : "aluno"}.</p>
                </div>
                {(
                  <>
                    <div className="col-span-full sm:col-span-3">
                      <Label htmlFor="matricula" className="font-medium">Nº de matrícula</Label>
                      <Input id="matricula" value={acad.matricula} placeholder="opcional" className="mt-2"
                        onChange={(e) => setAcad({ ...acad, matricula: e.target.value })} />
                    </div>
                    <div className="col-span-full sm:col-span-3">
                      <Label htmlFor="turno" className="font-medium">Turno</Label>
                      <select id="turno" value={acad.shift ?? ""} onChange={(e) => setAcad({ ...acad, shift: e.target.value as Shift })}
                        className={cx(selectCls, "mt-2")}>
                        <option value="">—</option>
                        {SHIFTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div className="col-span-full mt-6 flex justify-end">
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            </Block>
          </>
        )}

        {tab === "aparencia" && (
          <>
            <Block id="aparencia" title="Tema"
              desc="Fica salvo na sua conta. “Sistema” acompanha o claro/escuro do seu computador ou celular.">
              <ThemePicker />
            </Block>
            <Divider />
            <Block id="destaque" title="Cor de destaque"
              desc="Botões, links, item ativo e gráficos principais. As cores de situação (aprovada, cursando…) não mudam. Todas passam no contraste AA.">
              <div className="flex flex-col gap-5">
                <AccentPicker />
                <AppearancePreview />
              </div>
            </Block>
            <Divider />
            <Block id="barra" title="Barra lateral"
              desc="Clara como no template, escura nos dois temas ou na sua cor de destaque.">
              <SidebarPicker />
            </Block>
          </>
        )}

        {tab === "seguranca" && (
          <>
            <Block id="senha" title="Senha" desc="Trocar a senha encerra as suas outras sessões. Mínimo de 10 caracteres.">
              <form onSubmit={changePwd} className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                <div className="col-span-full">
                  <Label htmlFor="senha-atual" className="font-medium">Senha atual</Label>
                  <Input id="senha-atual" type="password" autoComplete="current-password" required className="mt-2"
                    value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
                </div>
                <div className="col-span-full sm:col-span-3">
                  <Label htmlFor="senha-nova" className="font-medium">Nova senha</Label>
                  <Input id="senha-nova" type="password" autoComplete="new-password" minLength={10} required className="mt-2"
                    value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
                </div>
                <div className="col-span-full sm:col-span-3">
                  <Label htmlFor="senha-conf" className="font-medium">Confirmar</Label>
                  <Input id="senha-conf" type="password" autoComplete="new-password" required className="mt-2"
                    value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
                </div>
                <div className="col-span-full mt-6 flex justify-end">
                  <Button type="submit">Alterar senha</Button>
                </div>
              </form>
            </Block>
            <Divider />
            <Block id="sessoes" title="Sessões ativas"
              desc={sessions ? `${sessions.count} sessão(ões) com refresh válido — este dispositivo incluído.` : "Carregando…"}>
              {sessions && sessions.sessions.length > 0 && (
                <ul role="list" className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                  {sessions.sessions.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="text-gray-900 dark:text-gray-50">Criada em {fmtDate.format(new Date(s.createdAt))}</span>
                      <span className="text-gray-500 dark:text-gray-400">expira {fmtDate.format(new Date(s.expiresAt))}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-6 flex justify-end">
                <Button variant="secondary" onClick={revokeOthers}>Encerrar as outras sessões</Button>
              </div>
            </Block>
          </>
        )}

        {tab === "cursos" && (
          <>
            <Block id="cursos" title="Meus cursos" desc="O período de ingresso alimenta a estimativa de formatura.">
              {!enrollments || enrollments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma matrícula ainda.</p>
              ) : (
                <ul role="list" className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                  {enrollments.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-end gap-3 py-4">
                      <div className="min-w-[220px] flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{e.course.name}</p>
                        <Badge variant="neutral" className="mt-1">{e.course.slug}</Badge>
                      </div>
                      <div className="w-32">
                        <Label htmlFor={`ingresso-${e.id}`} className="font-medium">Ingresso</Label>
                        <Input id={`ingresso-${e.id}`} placeholder="2022.2" className="mt-2"
                          value={startEdit[e.id] ?? e.startTerm ?? ""}
                          onChange={(ev) => setStartEdit((s) => ({ ...s, [e.id]: ev.target.value }))} />
                      </div>
                      <Button variant="secondary" onClick={() => saveStartTerm(e.id, e.startTerm)}>Salvar</Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-6 flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor="novo-curso" className="font-medium">Adicionar curso</Label>
                  <select id="novo-curso" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} className={cx(selectCls, "mt-2")}>
                    <option value="">— selecione —</option>
                    {courseList?.filter((c) => !enrollments?.some((e) => e.course.slug === c.slug))
                      .map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
                <Button disabled={!newCourse} onClick={addCourse}>Matricular</Button>
              </div>
            </Block>
            <Divider />
            <Block id="backup" title="Backup"
              desc="Exporta e restaura o seu progresso em JSON. A restauração é transacional e identifica as disciplinas pelo número na matriz — sobrevive a uma reimportação do curso.">
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={doExport}>Exportar JSON</Button>
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>Importar…</Button>
                <input ref={fileRef} type="file" accept="application/json" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ""; }} />
              </div>
            </Block>
          </>
        )}
      </div>
    </>
  );
}
