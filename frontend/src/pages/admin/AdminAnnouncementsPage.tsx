// RF-24 — Avisos: comunicados da instância, com audiência (todos / alunos / admins) e fixação.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { announcements } from "../../api/endpoints";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import type { Audience } from "../../api/types";

const AUDIENCES: { v: Audience; label: string; chip: string }[] = [
  { v: "ALL", label: "Todos", chip: "avail" },
  { v: "STUDENTS", label: "Alunos", chip: "cursando" },
  { v: "ADMINS", label: "Admins", chip: "sim" },
];
const audMeta = (v: Audience) => AUDIENCES.find((a) => a.v === v) ?? AUDIENCES[0]!;
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export default function AdminAnnouncementsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", body: "", audience: "ALL" as Audience, pinned: false });

  const { data: list, isLoading } = useQuery({ queryKey: ["announcements-admin"], queryFn: announcements.listAll });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["announcements-admin"] });
    qc.invalidateQueries({ queryKey: ["announcements-feed"] });
  };

  const create = useMutation({
    mutationFn: () => announcements.create({ ...form, title: form.title.trim(), body: form.body.trim() }),
    onSuccess: () => { invalidate(); setForm({ title: "", body: "", audience: "ALL", pinned: false }); },
  });
  const togglePin = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => announcements.update(v.id, { pinned: v.pinned }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => announcements.remove(id), onSuccess: invalidate });

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">administração · comunicação</span>
        <h1>Avisos</h1>
      </header>
      <p className="mut">Comunicados aparecem na Visão geral de quem estiver na audiência escolhida. Fixados vêm primeiro.</p>

      <Card>
        <h3>Novo aviso</h3>
        <form className="stack" style={{ gap: 10 }}
          onSubmit={(e) => { e.preventDefault(); if (form.title.trim().length >= 2 && form.body.trim()) create.mutate(); }}>
          <div className="row wrap" style={{ gap: 10, alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "2 1 260px" }}>Título
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={2} />
            </label>
            <label className="field" style={{ width: 160 }}>Audiência
              <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Audience })}>
                {AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
            </label>
            <label className="field" style={{ width: 130 }}>Fixar
              <select value={form.pinned ? "1" : "0"} onChange={(e) => setForm({ ...form, pinned: e.target.value === "1" })}>
                <option value="0">Não</option><option value="1">Sim</option>
              </select>
            </label>
          </div>
          <label className="field">Mensagem
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={4} required style={{ width: "100%" }} />
          </label>
          <div className="row"><Button type="submit" variant="prim" disabled={create.isPending}>Publicar</Button></div>
        </form>
      </Card>

      <Card tight>
        <h3 style={{ padding: "6px 8px 0" }}>Publicados</h3>
        {isLoading ? <div className="spinner" role="status">Carregando…</div> :
          !list?.length ? <p className="mut" style={{ padding: "0 8px 10px" }}>Nenhum aviso publicado.</p> : (
            <ul className="enr-list" style={{ padding: "0 8px 8px" }}>
              {list.map((a) => {
                const meta = audMeta(a.audience);
                return (
                  <li key={a.id} className="row wrap" style={{ gap: 10, alignItems: "flex-start" }}>
                    <span className={`chip ${meta.chip}`}><span className="swatch" />{meta.label}</span>
                    <span style={{ flex: "1 1 260px" }}>
                      <b>{a.pinned && "📌 "}{a.title}</b>
                      <br /><span className="mut" style={{ fontSize: ".84rem" }}>{a.body}</span>
                      <br /><small className="dim">
                        {fmt.format(new Date(a.createdAt))}{a.author?.name && ` · ${a.author.name}`}
                      </small>
                    </span>
                    <Button size="sm" onClick={() => togglePin.mutate({ id: a.id, pinned: !a.pinned })}>
                      {a.pinned ? "Desafixar" : "Fixar"}
                    </Button>
                    <Button size="sm" variant="warn"
                      onClick={() => { if (confirm(`Remover "${a.title}"?`)) remove.mutate(a.id); }}>Remover</Button>
                  </li>
                );
              })}
            </ul>
          )}
      </Card>
    </div>
  );
}
