"use client";

// Extras (RF-08/09): optativas fora da matriz, Núcleo Livre, Atividades Complementares e
// registros. Três estados — concluído soma no oficial, em andamento só na projeção,
// planejado não soma — e categoria reclassificável (um NL pode virar NC, NE ou optativa).
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { extras as extrasApi } from "@/lib/api/endpoints";
import { keys, useEnrollmentId, useExtras } from "@/hooks/use-progress";
import { Card, Chip, EmptyState, Field, PageHead, inputCls } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ExportButton, csvColumnsFrom } from "@/components/ui/export-button";
import Button from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Extra, ExtraCategory, ExtraStatus } from "@/lib/api/types";

const CATS: { v: ExtraCategory; label: string }[] = [
  { v: "NC", label: "Núcleo Comum" }, { v: "NE", label: "Núcleo Específico" },
  { v: "OPT", label: "NE optativa" }, { v: "NL", label: "Núcleo Livre" },
  { v: "AC", label: "Atividade Complementar" }, { v: "NONE", label: "Registro (não soma)" },
];
const STATUS: { v: ExtraStatus; label: string; tone: string }[] = [
  { v: "PLANNED", label: "Planejado", tone: "lock" },
  { v: "IN_PROGRESS", label: "Em andamento", tone: "cursando" },
  { v: "DONE", label: "Concluído", tone: "done" },
];
const catLabel = (v: ExtraCategory) => CATS.find((c) => c.v === v)?.label ?? v;
const statusMeta = (v: ExtraStatus) => STATUS.find((s) => s.v === v) ?? STATUS[2]!;

const EMPTY_FORM = { name: "", code: "", hours: 0, category: "NL" as ExtraCategory, status: "DONE" as ExtraStatus };

export default function ExtrasPage() {
  const enrollmentId = useEnrollmentId();
  const qc = useQueryClient();
  const { data: list, isLoading } = useExtras();
  const [form, setForm] = useState(EMPTY_FORM);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.extras(enrollmentId!) });
    qc.invalidateQueries({ queryKey: keys.progress(enrollmentId!) });
  };

  const create = useMutation({
    mutationFn: () => extrasApi.create(enrollmentId!, { ...form, code: form.code || undefined }),
    onSuccess: () => { invalidate(); setForm(EMPTY_FORM); toast.success("Componente adicionado."); },
    onError: () => toast.error("Não foi possível adicionar."),
  });
  const patch = useMutation({
    mutationFn: (v: { id: string; patch: { status?: ExtraStatus; category?: ExtraCategory } }) =>
      extrasApi.update(v.id, v.patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => extrasApi.remove(id),
    onSuccess: () => { invalidate(); toast.success("Componente removido."); },
  });

  const columns: Column<Extra>[] = [
    { header: "Nome", cell: (x) => x.name, value: (x) => x.name },
    { header: "Código", cell: (x) => <span className="text-muted-foreground font-mono text-xs">{x.code || "—"}</span>, value: (x) => x.code ?? "" },
    { header: "CH", cell: (x) => `${x.hours}h`, value: (x) => x.hours },
    {
      header: "Categoria",
      value: (x) => catLabel(x.category),
      cell: (x) => (
        // trocar a categoria reroteia a soma (ex.: NL -> NC / NE / optativa)
        <select value={x.category} aria-label={`Categoria de ${x.name}`}
          onChange={(e) => patch.mutate({ id: x.id, patch: { category: e.target.value as ExtraCategory } })}
          className={cn(inputCls, "py-1 text-xs")}>
          {CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
        </select>
      ),
    },
    {
      header: "Situação",
      value: (x) => statusMeta(x.status).label,
      cell: (x) => (
        <div className="flex items-center gap-2">
          <Chip tone={statusMeta(x.status).tone}>{statusMeta(x.status).label}</Chip>
          <select value={x.status} aria-label={`Situação de ${x.name}`}
            onChange={(e) => patch.mutate({ id: x.id, patch: { status: e.target.value as ExtraStatus } })}
            className={cn(inputCls, "py-1 text-xs")}>
            {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </div>
      ),
    },
    {
      header: "Ações", align: "right",
      cell: (x) => <Button size="sm" variant="danger" onClick={() => remove.mutate(x.id)}>Remover</Button>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="além da matriz" title="Componentes extras" />
      <p className="text-muted-foreground max-w-3xl text-sm">
        Optativas fora da matriz, Núcleo Livre, Atividades Complementares e registros (estágio, ligas, IC).
        <b className="text-foreground"> Concluído</b> soma no oficial;{" "}
        <b className="text-foreground">Em andamento</b> soma só na projeção;{" "}
        <b className="text-foreground">Planejado</b> não soma.
      </p>

      <Card>
        <h3 className="section-label">Adicionar</h3>
        <form className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); if (form.name.trim().length >= 2) create.mutate(); }}>
          <Field label="Nome" className="min-w-[220px] flex-[2]">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              required minLength={2} className={inputCls} />
          </Field>
          <Field label="Código" className="min-w-[110px] flex-1">
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="opcional" className={inputCls} />
          </Field>
          <Field label="CH" className="w-24">
            <input type="number" min={0} value={form.hours}
              onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="Categoria" className="min-w-[170px] flex-1">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExtraCategory })}
              className={inputCls}>
              {CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Situação" className="w-40">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ExtraStatus })}
              className={inputCls}>
              {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </Field>
          <Button type="submit" variant="primary" disabled={create.isPending}>Adicionar</Button>
        </form>
        {form.category === "OPT" && (
          <p className="text-muted-foreground mt-3 text-sm">
            A equivalência de optativas externas depende de validação da coordenação.
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="section-label !mb-0">Cadastrados</h3>
          <ExportButton name="extras" rows={list ?? []} columns={csvColumnsFrom(columns)} />
        </div>
        {isLoading ? <div className="skeleton h-40" /> : (
          <DataTable rows={list ?? []} columns={columns} keyOf={(x) => x.id}
            empty={<EmptyState>Nenhum componente extra cadastrado.</EmptyState>} />
        )}
      </Card>
    </div>
  );
}
