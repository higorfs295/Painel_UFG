// Admin (RF-01/13): criar/convidar/remover usuários e importar matrizes de curso.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin, courses } from "../api/endpoints";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

export default function AdminPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", role: "USER" as "USER" | "ADMIN", courseSlug: "" });
  const [lastLink, setLastLink] = useState("");
  const [matriz, setMatriz] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");

  const users = useQuery({ queryKey: ["admin-users"], queryFn: admin.listUsers });
  const courseList = useQuery({ queryKey: ["courses"], queryFn: courses.list });

  const create = useMutation({
    mutationFn: () => admin.createUser({ ...form, courseSlug: form.courseSlug || undefined }),
    onSuccess: (res) => { setLastLink(res.invite.link); setForm({ name: "", email: "", role: "USER", courseSlug: "" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });
  const reinvite = useMutation({ mutationFn: (id: string) => admin.reinvite(id), onSuccess: (res) => setLastLink(res.invite.link) });
  const remove = useMutation({ mutationFn: (id: string) => admin.removeUser(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }) });

  const doImport = useMutation({
    mutationFn: () => courses.import(JSON.parse(matriz)),
    onSuccess: (res) => { setImportMsg(`Curso "${res.slug}" importado (${res.subjects} disciplinas).`); setImportErr(""); setMatriz(""); qc.invalidateQueries({ queryKey: ["courses"] }); },
    onError: () => { setImportErr("JSON inválido ou erro na importação."); setImportMsg(""); },
  });

  return (
    <div className="stack">
      <h1>Administração</h1>

      <Card>
        <h3>Criar usuário</h3>
        <form className="row wrap" style={{ gap: 10, alignItems: "flex-end" }}
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <label className="field" style={{ flex: "1 1 180px" }}>Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></label>
          <label className="field" style={{ flex: "1 1 200px" }}>E-mail<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label className="field" style={{ width: 120 }}>Papel
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "USER" | "ADMIN" })}>
              <option value="USER">USER</option><option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <label className="field" style={{ flex: "1 1 200px" }}>Curso inicial (opcional)
            <select value={form.courseSlug} onChange={(e) => setForm({ ...form, courseSlug: e.target.value })}>
              <option value="">— nenhum —</option>
              {courseList.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <Button type="submit" variant="prim" disabled={create.isPending}>Criar + gerar convite</Button>
        </form>
        {lastLink && (
          <div className="ok mt">
            Link de convite (repasse ao usuário): <br />
            <code style={{ wordBreak: "break-all" }}>{lastLink}</code>
          </div>
        )}
      </Card>

      <Card tight>
        <h3 style={{ padding: "6px 8px 0" }}>Usuários</h3>
        {users.isLoading ? <div className="spinner">Carregando…</div> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Situação</th><th>Cursos</th><th style={{ textAlign: "right" }}>Ações</th></tr></thead>
              <tbody>
                {users.data?.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className="mut">{u.email}</td>
                    <td><span className="badge">{u.role}</span></td>
                    <td>{u.active ? <span className="chip done"><span className="swatch" />ativo</span> : <span className="chip avail"><span className="swatch" />convite pendente</span>}</td>
                    <td className="mut">{u.courses.map((c) => c.slug).join(", ") || "—"}</td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <Button size="sm" onClick={() => reinvite.mutate(u.id)}>Reenviar convite</Button>
                        <Button size="sm" variant="warn" onClick={() => { if (confirm(`Remover ${u.name}?`)) remove.mutate(u.id); }}>Remover</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3>Importar matriz de curso (RF-13)</h3>
        <p className="mut">Cole o JSON no mesmo formato do seed (<code>course</code>, <code>totalHours</code>, <code>requirements</code>, <code>milestones</code>, <code>subjects</code>).</p>
        <textarea value={matriz} onChange={(e) => setMatriz(e.target.value)} rows={8} style={{ width: "100%", fontFamily: "monospace" }} placeholder='{ "course": { "slug": "...", "name": "..." }, ... }' />
        <div className="row mt" style={{ gap: 8 }}>
          <Button variant="prim" disabled={!matriz.trim() || doImport.isPending} onClick={() => doImport.mutate()}>Importar</Button>
        </div>
        {importMsg && <div className="ok mt">{importMsg}</div>}
        {importErr && <div className="err mt">{importErr}</div>}
      </Card>
    </div>
  );
}
