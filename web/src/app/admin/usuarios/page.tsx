"use client";

// Admin · Usuários (RF-01/21): criar/convidar/remover contas, papéis e matrículas.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { admin, courses } from "@/lib/api/endpoints";
import { Badge, Card, Chip, EmptyState, Field, PageHead, Segmented, inputCls } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ExportButton } from "@/components/ui/export-button";
import Button from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/lib/api/types";

const ROLE_FILTERS = [
  { v: "all", label: "Todos" }, { v: "USER", label: "Alunos" },
  { v: "ADMIN", label: "Admins" }, { v: "pending", label: "Convite pendente" },
] as const;

const EMPTY = { name: "", email: "", role: "USER" as "USER" | "ADMIN", courseSlug: "" };

export default function AdminUsuariosPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [lastLink, setLastLink] = useState<{ link: string; emailed: boolean } | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]["v"]>("all");
  const [enrollPick, setEnrollPick] = useState<Record<string, string>>({});

  const users = useQuery({ queryKey: ["admin-users"], queryFn: admin.listUsers });
  const courseList = useQuery({ queryKey: ["courses"], queryFn: courses.list });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const create = useMutation({
    mutationFn: () => admin.createUser({ ...form, courseSlug: form.courseSlug || undefined }),
    onSuccess: (res) => {
      setLastLink(res.invite);
      setForm(EMPTY);
      invalidate();
      toast.success(res.invite.emailed ? "Convite enviado por e-mail." : "Usuário criado — repasse o link.");
    },
    onError: () => toast.error("Não foi possível criar (e-mail já cadastrado?)."),
  });
  const reinvite = useMutation({
    mutationFn: (id: string) => admin.reinvite(id),
    onSuccess: (res) => { setLastLink(res.invite); toast.success("Novo convite emitido."); },
  });
  const remove = useMutation({ mutationFn: (id: string) => admin.removeUser(id), onSuccess: () => { invalidate(); toast.success("Usuário removido."); } });
  const patchRole = useMutation({
    mutationFn: (v: { id: string; role: "ADMIN" | "USER" }) => admin.patchUser(v.id, { role: v.role }),
    onSuccess: invalidate,
    onError: () => toast.error("Não foi possível alterar o papel."),
  });
  const enroll = useMutation({ mutationFn: (v: { id: string; slug: string }) => admin.enrollUser(v.id, v.slug), onSuccess: invalidate });
  const unenroll = useMutation({ mutationFn: (v: { id: string; enrollmentId: string }) => admin.unenrollUser(v.id, v.enrollmentId), onSuccess: invalidate });

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (users.data ?? []).filter((u) =>
      (!n || u.name.toLowerCase().includes(n) || u.email.toLowerCase().includes(n) || (u.matricula ?? "").toLowerCase().includes(n)) &&
      (roleFilter === "all" || (roleFilter === "pending" ? !u.active : u.role === roleFilter)));
  }, [users.data, q, roleFilter]);

  const columns: Column<AdminUser>[] = [
    {
      header: "Nome",
      cell: (u) => <span>{u.name}{u.shift && <Badge className="ml-2">{u.shift}</Badge>}</span>,
      value: (u) => u.name,
    },
    { header: "E-mail", cell: (u) => <span className="text-muted-foreground">{u.email}</span>, value: (u) => u.email },
    { header: "Matrícula", cell: (u) => <span className="text-muted-foreground font-mono text-xs">{u.matricula || "—"}</span>, value: (u) => u.matricula ?? "" },
    {
      header: "Papel",
      value: (u) => u.role,
      cell: (u) => (
        <select value={u.role} aria-label={`Papel de ${u.name}`}
          onChange={(e) => patchRole.mutate({ id: u.id, role: e.target.value as "ADMIN" | "USER" })}
          className={cn(inputCls, "py-1 text-xs")}>
          <option value="USER">USER</option><option value="ADMIN">ADMIN</option>
        </select>
      ),
    },
    {
      header: "Situação",
      value: (u) => (u.active ? "ativo" : "convite pendente"),
      cell: (u) => <Chip tone={u.active ? "done" : "avail"}>{u.active ? "ativo" : "convite pendente"}</Chip>,
    },
    {
      header: "Cursos",
      value: (u) => u.courses.map((c) => c.slug).join(" | "),
      cell: (u) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {u.courses.map((c) => (
            <Badge key={c.enrollmentId} title={c.name}>
              {c.slug}
              <button aria-label={`Desmatricular de ${c.slug}`} className="hover:text-lock ml-1 cursor-pointer"
                onClick={() => unenroll.mutate({ id: u.id, enrollmentId: c.enrollmentId })}>×</button>
            </Badge>
          ))}
          <select value={enrollPick[u.id] ?? ""} aria-label={`Matricular ${u.name} em curso`}
            onChange={(e) => {
              const slug = e.target.value;
              setEnrollPick((p) => ({ ...p, [u.id]: "" }));
              if (slug) enroll.mutate({ id: u.id, slug });
            }}
            className={cn(inputCls, "py-0.5 text-xs")}>
            <option value="">+ curso</option>
            {courseList.data?.filter((c) => !u.courses.some((x) => x.slug === c.slug))
              .map((c) => <option key={c.slug} value={c.slug}>{c.slug}</option>)}
          </select>
        </div>
      ),
    },
    {
      header: "Ações", align: "right",
      cell: (u) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" onClick={() => reinvite.mutate(u.id)}>Reenviar convite</Button>
          <Button size="sm" variant="danger" onClick={() => remove.mutate(u.id)}>Remover</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="administração" title="Usuários" />

      <Card>
        <h3 className="section-label">Criar usuário + convite</h3>
        <form className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); if (form.name && form.email) create.mutate(); }}>
          <Field label="Nome" className="min-w-[180px] flex-1">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputCls} />
          </Field>
          <Field label="E-mail" className="min-w-[200px] flex-1">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className={inputCls} />
          </Field>
          <Field label="Papel" className="w-32">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "USER" | "ADMIN" })} className={inputCls}>
              <option value="USER">USER</option><option value="ADMIN">ADMIN</option>
            </select>
          </Field>
          <Field label="Curso inicial (opcional)" className="min-w-[200px] flex-1">
            <select value={form.courseSlug} onChange={(e) => setForm({ ...form, courseSlug: e.target.value })} className={inputCls}>
              <option value="">— nenhum —</option>
              {courseList.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
          <Button type="submit" variant="primary" disabled={create.isPending}>Criar + convite</Button>
        </form>

        {lastLink && (
          <div className="bg-muted mt-4 rounded-lg border p-3 text-sm">
            <p className="text-savanna">
              {lastLink.emailed ? "Convite enviado por e-mail — link (backup):" : "SMTP não configurado — repasse o link:"}
            </p>
            <code className="mt-1 block break-all text-xs">{lastLink.link}</code>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="section-label !mb-0">
            Usuários {users.data && <Badge className="ml-1">{rows.length} de {users.data.length}</Badge>}
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou matrícula…"
              aria-label="Buscar usuário" className={cn(inputCls, "min-w-[240px]")} />
            <Segmented label="Filtrar usuários" value={roleFilter} onChange={setRoleFilter} options={[...ROLE_FILTERS]} />
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

        {users.isLoading ? <div className="skeleton h-64" /> : (
          <DataTable rows={rows} columns={columns} keyOf={(u) => u.id}
            empty={<EmptyState>Nenhum usuário com esse filtro.</EmptyState>} />
        )}
      </Card>
    </div>
  );
}
