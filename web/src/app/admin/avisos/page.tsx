"use client";

// RF-24 — Avisos: comunicados da instância, com audiência (todos / alunos / admins) e fixação.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { announcements } from "@/lib/api/endpoints";
import { Card, Chip, EmptyState, Field, PageHead, inputCls } from "@/components/ui";
import Button from "@/components/ui/button";
import { IconFlame } from "@/components/ui/icons";
import { cn, fmtDate } from "@/lib/utils";
import type { Audience } from "@/lib/api/types";

const AUDIENCES: { v: Audience; label: string; tone: string }[] = [
  { v: "ALL", label: "Todos", tone: "avail" },
  { v: "STUDENTS", label: "Alunos", tone: "cursando" },
  { v: "ADMINS", label: "Admins", tone: "sim" },
];
const audMeta = (v: Audience) => AUDIENCES.find((a) => a.v === v) ?? AUDIENCES[0]!;

const EMPTY = { title: "", body: "", audience: "ALL" as Audience, pinned: false };

export default function AdminAvisosPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);

  const { data: list, isLoading } = useQuery({ queryKey: ["announcements-admin"], queryFn: announcements.listAll });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["announcements-admin"] });
    qc.invalidateQueries({ queryKey: ["announcements-feed"] });
  };

  const create = useMutation({
    mutationFn: () => announcements.create({ ...form, title: form.title.trim(), body: form.body.trim() }),
    onSuccess: () => { invalidate(); setForm(EMPTY); toast.success("Aviso publicado."); },
    onError: () => toast.error("Não foi possível publicar."),
  });
  const togglePin = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => announcements.update(v.id, { pinned: v.pinned }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => announcements.remove(id),
    onSuccess: () => { invalidate(); toast.success("Aviso removido."); },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="administração · comunicação" title="Avisos" />
      <p className="text-muted-foreground text-sm">
        Comunicados aparecem na Visão geral de quem estiver na audiência escolhida. Fixados vêm primeiro.
      </p>

      <Card>
        <h3 className="section-label">Novo aviso</h3>
        <form className="flex flex-col gap-3"
          onSubmit={(e) => { e.preventDefault(); if (form.title.trim().length >= 2 && form.body.trim()) create.mutate(); }}>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Título" className="min-w-[260px] flex-[2]">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                required minLength={2} className={inputCls} />
            </Field>
            <Field label="Audiência" className="w-40">
              <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Audience })}
                className={inputCls}>
                {AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
            </Field>
            <label className="text-muted-foreground flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="accent-primary size-4" />
              Fixar no topo
            </label>
          </div>
          <Field label="Mensagem">
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={4} required className={cn(inputCls, "w-full")} />
          </Field>
          <div>
            <Button type="submit" variant="primary" disabled={create.isPending}>Publicar</Button>
          </div>
        </form>
      </Card>

      {isLoading ? <div className="skeleton h-40" /> : !list || list.length === 0 ? (
        <EmptyState>Nenhum aviso publicado ainda.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.pinned && <IconFlame className="text-ember shrink-0" />}
                    <b className="font-medium">{a.title}</b>
                    <Chip tone={audMeta(a.audience).tone}>{audMeta(a.audience).label}</Chip>
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm whitespace-pre-line">{a.body}</p>
                  <p className="text-subtle-foreground mt-2 text-xs">
                    {fmtDate.format(new Date(a.createdAt))}{a.author?.name ? ` · ${a.author.name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => togglePin.mutate({ id: a.id, pinned: !a.pinned })}>
                    {a.pinned ? "Desafixar" : "Fixar"}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove.mutate(a.id)}>Remover</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
