// Ajustes: perfil (nome), senha, matrículas (com período de ingresso), tema (RF-15) e backup
// (RF-16). O período letivo corrente é GLOBAL (calendário dos admins, RF-20 v2) — quem é
// ADMIN gerencia em /admin/periodos; aqui só aparece o que é da conta.
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { me, courses } from "../api/endpoints";
import { useAuth, applyTheme } from "../store/auth";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import type { Shift } from "../api/types";

const SHIFTS: { v: Shift; label: string }[] = [
  { v: "matutino", label: "Matutino" }, { v: "vespertino", label: "Vespertino" },
  { v: "noturno", label: "Noturno" }, { v: "integral", label: "Integral" },
];

const TERM_RE = /^\d{4}\.[12]$/;

export default function SettingsPage() {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const patchUser = useAuth((s) => s.patchUser);
  const isAdmin = user?.role === "ADMIN";
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // perfil
  const [name, setName] = useState(user?.name ?? "");
  // dados acadêmicos (aluno): matrícula (opcional) e turno
  const [acad, setAcad] = useState({ matricula: user?.matricula ?? "", shift: user?.shift ?? "" });
  const [acadMsg, setAcadMsg] = useState("");
  // sessões ativas (segurança)
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: me.sessions });
  const [sessMsg, setSessMsg] = useState("");
  async function revokeOthers() {
    setSessMsg("");
    try {
      const res = await me.revokeOtherSessions();
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setSessMsg(`${res.revoked} sessão(ões) encerrada(s).`);
    } catch { setSessMsg("Falha ao encerrar as sessões."); }
  }
  // senha
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdMsg, setPwdMsg] = useState<{ ok?: string; err?: string }>({});
  // matrículas (aluno)
  const { data: enrollments } = useQuery({ queryKey: ["enrollments"], queryFn: me.enrollments, enabled: !isAdmin });
  const { data: courseList } = useQuery({ queryKey: ["courses"], queryFn: courses.list, enabled: !isAdmin });
  const [newCourse, setNewCourse] = useState("");
  const [startEdit, setStartEdit] = useState<Record<string, string>>({}); // enrollmentId -> valor digitado
  const [startMsg, setStartMsg] = useState("");

  async function saveName() {
    setErr(""); setMsg("");
    try {
      const updated = await me.updateSettings({ name });
      patchUser({ name: updated.name });
      setMsg("Nome atualizado.");
    } catch { setErr("Falha ao salvar o nome."); }
  }

  async function saveAcad() {
    setAcadMsg("");
    try {
      const updated = await me.updateSettings({
        matricula: acad.matricula.trim() || null,
        shift: (acad.shift || null) as Shift | null,
      });
      patchUser({ matricula: updated.matricula, shift: updated.shift });
      setAcadMsg("Dados acadêmicos salvos.");
    } catch { setAcadMsg("Falha ao salvar."); }
  }

  async function changePwd(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg({});
    if (pwd.next.length < 10) { setPwdMsg({ err: "A nova senha precisa de ao menos 10 caracteres." }); return; }
    if (pwd.next !== pwd.confirm) { setPwdMsg({ err: "As senhas não coincidem." }); return; }
    try {
      await me.changePassword(pwd.current, pwd.next);
      setPwd({ current: "", next: "", confirm: "" });
      setPwdMsg({ ok: "Senha alterada. Suas outras sessões foram encerradas." });
    } catch { setPwdMsg({ err: "Senha atual incorreta." }); }
  }

  async function saveStartTerm(enrollmentId: string, current: string | null) {
    setStartMsg("");
    const value = (startEdit[enrollmentId] ?? current ?? "").trim();
    if (value && !TERM_RE.test(value)) { setStartMsg("Formato: AAAA.S (ex.: 2022.2)"); return; }
    try {
      await me.updateEnrollment(enrollmentId, { startTerm: value || null });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      setStartMsg("Ingresso salvo.");
    } catch { setStartMsg("Falha ao salvar."); }
  }

  async function addCourse() {
    if (!newCourse) return;
    try {
      await me.selfEnroll(newCourse);
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      setNewCourse("");
    } catch { /* mensagem genérica abaixo via estado? mantemos silencioso e a lista não muda */ }
  }

  async function setTheme(theme: "dark" | "light") {
    applyTheme(theme); patchUser({ theme });
    try { await me.updateSettings({ theme }); } catch { /* persiste na próxima */ }
  }

  async function doExport() {
    setErr(""); setMsg("");
    try {
      const data = await me.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `painel-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      setMsg("Backup exportado.");
    } catch { setErr("Falha ao exportar."); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(""); setMsg("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const res = await me.importBackup(data);
      qc.invalidateQueries();
      setMsg(`Backup importado: ${res.restored} curso(s) restaurado(s)` +
        (res.skippedCourses.length ? `; ignorados: ${res.skippedCourses.join(", ")}` : "") + ".");
    } catch { setErr("Arquivo inválido ou falha ao importar."); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">preferências</span>
        <h1>Ajustes</h1>
      </header>

      <Card>
        <h3>Conta</h3>
        <p className="mut">{user?.email} · perfil <span className="badge">{user?.role}</span></p>
        <div className="row wrap mt" style={{ alignItems: "flex-end", gap: 10 }}>
          <label className="field" style={{ flex: "1 1 240px" }}>Nome
            <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} />
          </label>
          <Button onClick={saveName} disabled={name.trim().length < 2 || name === user?.name}>Salvar nome</Button>
        </div>
        {msg && <div className="ok mt">{msg}</div>}
        {err && <div className="err mt">{err}</div>}
      </Card>

      {!isAdmin && (
        <Card>
          <h3>Dados acadêmicos</h3>
          <p className="mut">Número de matrícula (opcional) e turno das aulas — usados para identificar e organizar o cronograma.</p>
          <div className="row wrap mt" style={{ alignItems: "flex-end", gap: 10 }}>
            <label className="field" style={{ flex: "1 1 200px" }}>Nº de matrícula
              <input value={acad.matricula} onChange={(e) => setAcad({ ...acad, matricula: e.target.value })}
                placeholder="ex.: 20240010000" maxLength={30} inputMode="numeric" />
            </label>
            <label className="field" style={{ width: 170 }}>Turno
              <select value={acad.shift} onChange={(e) => setAcad({ ...acad, shift: e.target.value as Shift | "" })}>
                <option value="">— não informado —</option>
                {SHIFTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </label>
            <Button onClick={saveAcad}
              disabled={acad.matricula === (user?.matricula ?? "") && acad.shift === (user?.shift ?? "")}>
              Salvar
            </Button>
          </div>
          {acadMsg && <div className={acadMsg.includes("salvos") ? "ok mt" : "err mt"}>{acadMsg}</div>}
        </Card>
      )}

      <Card>
        <h3>Senha</h3>
        <form className="row wrap" style={{ gap: 10, alignItems: "flex-end" }} onSubmit={changePwd}>
          <label className="field" style={{ flex: "1 1 160px" }}>Senha atual
            <input type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} required />
          </label>
          <label className="field" style={{ flex: "1 1 160px" }}>Nova senha
            <input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} required />
          </label>
          <label className="field" style={{ flex: "1 1 160px" }}>Confirmar
            <input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
          </label>
          <Button type="submit" variant="prim">Alterar senha</Button>
        </form>
        {pwdMsg.ok && <div className="ok mt">{pwdMsg.ok}</div>}
        {pwdMsg.err && <div className="err mt" role="alert">{pwdMsg.err}</div>}
      </Card>

      {/* Segurança: sessões ativas (refresh tokens vivos) — permite encerrar as outras */}
      <Card>
        <h3>Sessões ativas</h3>
        <p className="mut">
          Cada dispositivo onde você entrou mantém uma sessão. Se algo parecer estranho,
          encerre as outras — elas precisarão entrar de novo.
        </p>
        {!sessions ? <div className="spinner" role="status">Carregando…</div> : (
          <>
            <ul className="enr-list">
              {sessions.sessions.map((s, i) => (
                <li key={s.id} className="row wrap" style={{ gap: 10 }}>
                  <span className="chip avail"><span className="swatch" />sessão {i + 1}</span>
                  <span className="mut" style={{ fontSize: ".84rem" }}>
                    iniciada em {new Date(s.createdAt).toLocaleString("pt-BR")} · expira em{" "}
                    {new Date(s.expiresAt).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="row wrap mt" style={{ gap: 10 }}>
              <Button onClick={revokeOthers} disabled={sessions.count < 2}>
                Encerrar as outras sessões
              </Button>
              <span className="mut" style={{ fontSize: ".84rem" }}>{sessions.count} ativa(s)</span>
            </div>
            {sessMsg && <div className="ok mt">{sessMsg}</div>}
          </>
        )}
      </Card>

      {!isAdmin && (
        <Card>
          <h3>Matrículas</h3>
          <p className="mut">O período letivo corrente é definido pelo calendário acadêmico da instância
            (aparece no topo). Aqui você registra apenas o seu período de <b>ingresso</b> em cada curso.</p>
          {!enrollments?.length ? <p className="mut">Nenhuma matrícula.</p> : (
            <ul className="enr-list">
              {enrollments.map((e) => (
                <li key={e.id} className="row wrap" style={{ gap: 10, alignItems: "flex-end" }}>
                  <span style={{ flex: "1 1 220px" }}>
                    {e.course.name} <span className="badge">{e.course.slug}</span>
                  </span>
                  <label className="field" style={{ width: 130 }}>Ingresso
                    <input placeholder="2022.2" value={startEdit[e.id] ?? e.startTerm ?? ""}
                      onChange={(ev) => setStartEdit((p) => ({ ...p, [e.id]: ev.target.value }))} />
                  </label>
                  <Button size="sm" onClick={() => saveStartTerm(e.id, e.startTerm)}>Salvar</Button>
                </li>
              ))}
            </ul>
          )}
          {startMsg && <div className={startMsg.includes("salvo") ? "ok mt" : "err mt"}>{startMsg}</div>}
          <div className="row wrap mt" style={{ alignItems: "flex-end", gap: 10 }}>
            <label className="field" style={{ flex: "1 1 240px" }}>Adicionar curso
              <select value={newCourse} onChange={(e) => setNewCourse(e.target.value)}>
                <option value="">— selecione —</option>
                {courseList?.filter((c) => !enrollments?.some((e) => e.course.slug === c.slug))
                  .map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
            <Button onClick={addCourse} disabled={!newCourse}>Matricular</Button>
          </div>
        </Card>
      )}

      <Card>
        <h3>Tema</h3>
        <div className="row" style={{ gap: 8 }}>
          <Button variant={user?.theme === "dark" ? "prim" : "default"} onClick={() => setTheme("dark")}>🌙 Escuro</Button>
          <Button variant={user?.theme === "light" ? "prim" : "default"} onClick={() => setTheme("light")}>☀️ Claro</Button>
        </div>
      </Card>

      {!isAdmin && (
        <Card>
          <h3>Backup</h3>
          <p className="mut">Exporte todos os seus dados (status, extras, cenários, tema) em JSON, ou reimporte para reconstruir o estado.</p>
          <div className="row" style={{ gap: 8 }}>
            <Button onClick={doExport}>Exportar JSON</Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>Importar JSON</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
          </div>
        </Card>
      )}
    </div>
  );
}
