// Admin · Usuários (RF-01/21): criar/convidar/remover contas, papéis e matrículas.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin, courses } from "../../api/endpoints";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import ExportButton from "../../components/ui/ExportButton";

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", role: "USER" as "USER" | "ADMIN", courseSlug: "" });
  const [lastLink, setLastLink] = useState<{ link: string; emailed: boolean } | null>(null);
  const [enrollPick, setEnrollPick] = useState<Record<string, string>>({}); // userId -> slug
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "ADMIN" | "USER" | "pending">("all");

  const users = useQuery({ queryKey: ["admin-users"], queryFn: admin.listUsers });
  const courseList = useQuery({ queryKey: ["courses"], queryFn: courses.list });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const create = useMutation({
    mutationFn: () => admin.createUser({ ...form, courseSlug: form.courseSlug || undefined }),
    onSuccess: (res) => { setLastLink(res.invite); setForm({ name: "", email: "", role: "USER", courseSlug: "" }); invalidate(); },
  });
  const reinvite = useMutation({ mutationFn: (id: string) => admin.reinvite(id), onSuccess: (res) => setLastLink(res.invite) });
  const remove = useMutation({ mutationFn: (id: string) => admin.removeUser(id), onSuccess: invalidate });
  const patchRole = useMutation({
    mutationFn: (v: { id: string; role: "ADMIN" | "USER" }) => admin.patchUser(v.id, { role: v.role }),
    onSuccess: invalidate,
  });
  const enroll = useMutation({
    mutationFn: (v: { id: string; slug: string }) => admin.enrollUser(v.id, v.slug),
    onSuccess: invalidate,
  });
  const unenroll = useMutation({
    mutationFn: (v: { id: string; enrollmentId: string }) => admin.unenrollUser(v.id, v.enrollmentId),
    onSuccess: invalidate,
  });

  // busca + filtro de papel/situação, aplicados uma vez só (tabela e CSV usam a mesma lista)
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (users.data ?? []).filter((u) =>
      (!n || u.name.toLowerCase().includes(n) || u.email.toLowerCase().includes(n) || (u.matricula ?? "").toLowerCase().includes(n)) &&
      (roleFilter === "all" ||
        (roleFilter === "pending" ? !u.active : u.role === roleFilter)));
  }, [users.data, q, roleFilter]);

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">administração · contas</span>
        <h1>Usuários</h1>
      </header>

      <Card>
        <h3>Criar usuário (com convite)</h3>
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
          <Button type="submit" variant="prim" disabled={create.isPending}>Criar + convite</Button>
        </form>
        {lastLink && (
          <div className="ok mt">
            {lastLink.emailed ? "Convite enviado por e-mail ✉️ — link (backup):" : "SMTP não configurado — repasse o link:"}<br />
            <code style={{ wordBreak: "break-all" }}>{lastLink.link}</code>
          </div>
        )}
      </Card>

      <Card tight>
        <div className="row spread wrap" style={{ padding: "6px 8px 0", gap: 10 }}>
          <h3 style={{ margin: 0 }}>
            Usuários {users.data && <span className="badge" style={{ marginLeft: 4 }}>{rows.length} de {users.data.length}</span>}
          </h3>
          <div className="row wrap" style={{ gap: 8 }}>
            <input placeholder="Buscar por nome, e-mail ou matrícula…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
            <div className="seg" role="tablist" aria-label="Filtrar usuários">
              {([["all", "Todos"], ["USER", "Alunos"], ["ADMIN", "Admins"], ["pending", "Convite pendente"]] as const).map(([v, label]) => (
                <button key={v} type="button" role="tab" aria-selected={roleFilter === v}
                  className={"seg-btn" + (roleFilter === v ? " on" : "")}
                  onClick={() => setRoleFilter(v)}>{label}</button>
              ))}
            </div>
            <ExportButton name="usuarios" rows={rows} columns={[
              { header: "Nome", value: (u) => u.name },
              { header: "E-mail", value: (u) => u.email },
              { header: "Matrícula", value: (u) => u.matricula ?? "" },
              { header: "Turno", value: (u) => u.shift ?? "" },
              { header: "Papel", value: (u) => u.role },
              { header: "Situação", value: (u) => (u.active ? "ativo" : "convite pendente") },
              { header: "Cursos", value: (u) => u.courses.map((c) => c.slug).join(" | ") },
            ]} />
          </div>
        </div>
        {users.isLoading ? <div className="spinner" role="status">Carregando…</div> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Matrícula</th><th>Papel</th><th>Situação</th><th>Cursos</th><th style={{ textAlign: "right" }}>Ações</th></tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}{u.shift && <span className="badge" style={{ marginLeft: 6 }}>{u.shift}</span>}</td>
                    <td className="mut">{u.email}</td>
                    <td className="mut">{u.matricula || "—"}</td>
                    <td>
                      <select value={u.role} aria-label={`Papel de ${u.name}`}
                        onChange={(e) => patchRole.mutate({ id: u.id, role: e.target.value as "ADMIN" | "USER" })}>
                        <option value="USER">USER</option><option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td>{u.active ? <span className="chip done"><span className="swatch" />ativo</span> : <span className="chip avail"><span className="swatch" />convite pendente</span>}</td>
                    <td>
                      <div className="row wrap" style={{ gap: 4 }}>
                        {u.courses.map((c) => (
                          <span key={c.enrollmentId} className="badge" title={c.name}>
                            {c.slug}
                            <button className="btn ghost sm" style={{ padding: "0 3px", marginLeft: 2 }}
                              aria-label={`Desmatricular de ${c.slug}`}
                              onClick={() => { if (confirm(`Remover a matrícula de ${u.name} em ${c.name}? Os dados dela serão apagados.`)) unenroll.mutate({ id: u.id, enrollmentId: c.enrollmentId }); }}>×</button>
                          </span>
                        ))}
                        <select value={enrollPick[u.id] ?? ""} aria-label={`Matricular ${u.name} em curso`}
                          onChange={(e) => {
                            const slug = e.target.value;
                            setEnrollPick((p) => ({ ...p, [u.id]: "" }));
                            if (slug) enroll.mutate({ id: u.id, slug });
                          }}>
                          <option value="">+ curso</option>
                          {courseList.data?.filter((c) => !u.courses.some((x) => x.slug === c.slug))
                            .map((c) => <option key={c.slug} value={c.slug}>{c.slug}</option>)}
                        </select>
                      </div>
                    </td>
                    <td>
                      <div className="row wrap" style={{ gap: 6, justifyContent: "flex-end" }}>
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
    </div>
  );
}
