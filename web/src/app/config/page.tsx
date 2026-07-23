"use client";

// Ajustes da conta (RF-15/16): perfil, dados acadêmicos, senha, sessões, matrículas e
// backup. O período letivo corrente é GLOBAL (calendário dos admins, RF-20 v2) — quem é
// ADMIN gerencia em /admin/periodos; aqui só o que é da conta.
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { courses, me } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth-store";
import { Badge, Card, EmptyState, Field, PageHead, Section, inputCls } from "@/components/ui";
import Button from "@/components/ui/button";
import { cn, fmtDate } from "@/lib/utils";
import type { Shift } from "@/lib/api/types";

const SHIFTS: { v: Shift; label: string }[] = [
  { v: "matutino", label: "Matutino" }, { v: "vespertino", label: "Vespertino" },
  { v: "noturno", label: "Noturno" }, { v: "integral", label: "Integral" },
];
const TERM_RE = /^\d{4}\.[12]$/;

export default function ConfigPage() {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const patchUser = useAuth((s) => s.patchUser);
  const isAdmin = user?.role === "ADMIN";
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [acad, setAcad] = useState({ matricula: user?.matricula ?? "", shift: user?.shift ?? "" });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [newCourse, setNewCourse] = useState("");
  const [startEdit, setStartEdit] = useState<Record<string, string>>({});

  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: me.sessions });
  const { data: enrollments } = useQuery({ queryKey: ["enrollments"], queryFn: me.enrollments, enabled: !isAdmin });
  const { data: courseList } = useQuery({ queryKey: ["courses"], queryFn: courses.list, enabled: !isAdmin });

  async function saveName() {
    try {
      const updated = await me.updateSettings({ name });
      patchUser({ name: updated.name });
      toast.success("Nome atualizado.");
    } catch { toast.error("Falha ao salvar o nome."); }
  }

  async function saveAcad() {
    try {
      const updated = await me.updateSettings({
        matricula: acad.matricula.trim() || null,
        shift: (acad.shift || null) as Shift | null,
      });
      patchUser({ matricula: updated.matricula, shift: updated.shift });
      toast.success("Dados acadêmicos salvos.");
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

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="sua conta" title="Ajustes" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Perfil">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Nome" className="min-w-[200px] flex-1">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <Button onClick={saveName}>Salvar</Button>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            E-mail: <b className="text-foreground">{user?.email}</b> · papel: <Badge>{user?.role}</Badge>
          </p>
        </Section>

        {!isAdmin && (
          <Section title="Dados acadêmicos" hint="a matrícula é guardada cifrada no banco">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Nº de matrícula" className="min-w-[160px] flex-1">
                <input value={acad.matricula} onChange={(e) => setAcad({ ...acad, matricula: e.target.value })}
                  placeholder="opcional" className={inputCls} />
              </Field>
              <Field label="Turno" className="w-40">
                <select value={acad.shift ?? ""} onChange={(e) => setAcad({ ...acad, shift: e.target.value as Shift })}
                  className={inputCls}>
                  <option value="">—</option>
                  {SHIFTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </Field>
              <Button onClick={saveAcad}>Salvar</Button>
            </div>
          </Section>
        )}
      </div>

      <Section title="Segurança">
        <form className="flex flex-wrap items-end gap-3" onSubmit={changePwd}>
          <Field label="Senha atual" className="min-w-[160px] flex-1">
            <input type="password" autoComplete="current-password" value={pwd.current}
              onChange={(e) => setPwd({ ...pwd, current: e.target.value })} required className={inputCls} />
          </Field>
          <Field label="Nova senha" className="min-w-[160px] flex-1">
            <input type="password" autoComplete="new-password" minLength={10} value={pwd.next}
              onChange={(e) => setPwd({ ...pwd, next: e.target.value })} required className={inputCls} />
          </Field>
          <Field label="Confirmar" className="min-w-[160px] flex-1">
            <input type="password" autoComplete="new-password" value={pwd.confirm}
              onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required className={inputCls} />
          </Field>
          <Button type="submit" variant="primary">Alterar senha</Button>
        </form>

        <div className="mt-6 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium">Sessões ativas</h4>
              <p className="text-muted-foreground text-sm">
                {sessions ? `${sessions.count} sessão(ões) — este dispositivo incluído.` : "Carregando…"}
              </p>
            </div>
            <Button size="sm" onClick={revokeOthers}>Encerrar as outras</Button>
          </div>
          {sessions && sessions.sessions.length > 0 && (
            <ul className="text-muted-foreground mt-3 flex flex-col gap-1 text-xs">
              {sessions.sessions.slice(0, 5).map((s) => (
                <li key={s.id} className="font-mono">
                  criada em {fmtDate.format(new Date(s.createdAt))} · expira em {fmtDate.format(new Date(s.expiresAt))}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {!isAdmin && (
        <Section title="Meus cursos" hint="o período de ingresso alimenta a estimativa de formatura">
          {!enrollments || enrollments.length === 0 ? (
            <EmptyState>Nenhuma matrícula ainda.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {enrollments.map((e) => (
                <li key={e.id} className="flex flex-wrap items-end gap-3 border-b pb-3 last:border-0">
                  <span className="min-w-[220px] flex-1">
                    <b className="text-sm font-medium">{e.course.name}</b>
                    <Badge className="ml-2">{e.course.slug}</Badge>
                  </span>
                  <Field label="Ingresso" className="w-32">
                    <input value={startEdit[e.id] ?? e.startTerm ?? ""}
                      onChange={(ev) => setStartEdit((s) => ({ ...s, [e.id]: ev.target.value }))}
                      placeholder="2022.2" className={cn(inputCls, "py-1.5 text-sm")} />
                  </Field>
                  <Button size="sm" onClick={() => saveStartTerm(e.id, e.startTerm)}>Salvar</Button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Field label="Adicionar curso" className="min-w-[220px] flex-1">
              <select value={newCourse} onChange={(e) => setNewCourse(e.target.value)} className={inputCls}>
                <option value="">— selecione —</option>
                {courseList?.filter((c) => !enrollments?.some((e) => e.course.slug === c.slug))
                  .map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </Field>
            <Button disabled={!newCourse} onClick={addCourse}>Matricular</Button>
          </div>
        </Section>
      )}

      <Section title="Backup" hint="exporta e restaura o seu progresso; portável entre instâncias">
        <div className="flex flex-wrap gap-3">
          <Button onClick={doExport}>Exportar JSON</Button>
          <Button onClick={() => fileRef.current?.click()}>Importar…</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ""; }} />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          A restauração é transacional e identifica as disciplinas pelo número na matriz, então
          sobrevive a uma reimportação do curso.
        </p>
      </Section>
    </div>
  );
}
