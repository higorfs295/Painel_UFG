"use client";

// Agenda (RF-25): provas, trabalhos e entregas com prazo, agrupados por urgência.
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { planner } from "@/lib/api/endpoints";
import { keys, useEnrollmentId, useTasks } from "@/hooks/use-progress";
import { Badge, Card, Chip, EmptyState, Field, PageHead, Segmented, inputCls } from "@/components/ui";
import { ExportButton } from "@/components/ui/export-button";
import Button from "@/components/ui/button";
import { cn, fmtDate } from "@/lib/utils";
import type { StudyTask, TaskKind } from "@/lib/api/types";

const KINDS: { v: TaskKind; label: string; tone: string }[] = [
  { v: "PROVA", label: "Prova", tone: "lock" },
  { v: "TRABALHO", label: "Trabalho", tone: "sim" },
  { v: "ENTREGA", label: "Entrega", tone: "avail" },
  { v: "OUTRO", label: "Outro", tone: "co" },
];
const kindMeta = (v: TaskKind) => KINDS.find((k) => k.v === v) ?? KINDS[3]!;

const DAY = 86_400_000;
type Bucket = "atrasadas" | "semana" | "depois" | "feitas";

function bucketOf(t: StudyTask): Bucket {
  if (t.done) return "feitas";
  if (!t.dueAt) return "depois";
  const diff = new Date(t.dueAt).getTime() - Date.now();
  if (diff < 0) return "atrasadas";
  return diff <= 7 * DAY ? "semana" : "depois";
}

const BUCKETS: { key: Bucket; label: string; hint: string }[] = [
  { key: "atrasadas", label: "Atrasadas", hint: "prazo vencido" },
  { key: "semana", label: "Próximos 7 dias", hint: "atenção" },
  { key: "depois", label: "Mais adiante", hint: "sem urgência" },
  { key: "feitas", label: "Concluídas", hint: "" },
];

const EMPTY = { title: "", kind: "PROVA" as TaskKind, dueAt: "", subjectCode: "" };

export default function AgendaPage() {
  const enrollmentId = useEnrollmentId();
  const qc = useQueryClient();
  const { data: list, isLoading } = useTasks();
  const [form, setForm] = useState(EMPTY);
  const [only, setOnly] = useState<Bucket | "todas">("todas");
  const [kindFilter, setKindFilter] = useState<TaskKind | "all">("all");

  const invalidate = () => qc.invalidateQueries({ queryKey: keys.tasks(enrollmentId!) });

  const create = useMutation({
    mutationFn: () => planner.addTask(enrollmentId!, {
      title: form.title.trim(), kind: form.kind,
      // 12:00 evita que o fuso empurre o item para o dia anterior
      dueAt: form.dueAt ? new Date(`${form.dueAt}T12:00:00`).toISOString() : null,
      subjectCode: form.subjectCode.trim() || null,
    }),
    onSuccess: () => { invalidate(); setForm(EMPTY); toast.success("Item adicionado à agenda."); },
    onError: () => toast.error("Não foi possível adicionar."),
  });
  const toggle = useMutation({ mutationFn: (t: StudyTask) => planner.patchTask(t.id, { done: !t.done }), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => planner.removeTask(id), onSuccess: invalidate });

  const visible = useMemo(
    () => (list ?? []).filter((t) =>
      (kindFilter === "all" || t.kind === kindFilter) && (only === "todas" || bucketOf(t) === only)),
    [list, kindFilter, only]);

  const grouped = useMemo(() => {
    const map: Record<Bucket, StudyTask[]> = { atrasadas: [], semana: [], depois: [], feitas: [] };
    for (const t of visible) map[bucketOf(t)].push(t);
    return map;
  }, [visible]);

  const pending = (list ?? []).filter((t) => !t.done).length;
  // a contagem de atrasadas ignora os filtros: é um alerta, não um resultado de busca
  const late = (list ?? []).filter((t) => bucketOf(t) === "atrasadas").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="organização" title="Agenda" />
      <p className="text-muted-foreground text-sm">
        {pending > 0
          ? <>Você tem <b className="text-foreground">{pending}</b> pendência(s){late > 0 && <> — <b className="text-lock">{late} atrasada(s)</b></>}.</>
          : "Nada pendente por aqui."}
      </p>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented label="Filtrar por urgência" value={only} onChange={setOnly}
            options={[{ v: "todas" as const, label: "Todas" },
              ...BUCKETS.map((b) => ({ v: b.key, label: b.key === "atrasadas" && late > 0 ? `${b.label} (${late})` : b.label }))]} />
          <div className="flex flex-wrap items-center gap-3">
            <Field label="Tipo" className="flex-row items-center gap-2">
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as TaskKind | "all")}
                aria-label="Filtrar por tipo" className={cn(inputCls, "py-1 text-xs")}>
                <option value="all">todos</option>
                {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
              </select>
            </Field>
            <ExportButton name="agenda" rows={visible} columns={[
              { header: "Título", value: (t) => t.title },
              { header: "Tipo", value: (t) => kindMeta(t.kind).label },
              { header: "Prazo", value: (t) => (t.dueAt ? fmtDate.format(new Date(t.dueAt)) : "") },
              { header: "Disciplina", value: (t) => t.subjectCode ?? "" },
              { header: "Situação", value: (t) => (t.done ? "Concluída" : bucketOf(t) === "atrasadas" ? "Atrasada" : "Pendente") },
            ]} />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="section-label">Adicionar</h3>
        <form className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); if (form.title.trim().length >= 2) create.mutate(); }}>
          <Field label="Título" className="min-w-[240px] flex-[2]">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              required minLength={2} placeholder="Prova 1 de Cálculo" className={inputCls} />
          </Field>
          <Field label="Tipo" className="w-40">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TaskKind })} className={inputCls}>
              {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
            </select>
          </Field>
          <Field label="Prazo" className="w-44">
            <input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Disciplina" className="w-36">
            <input value={form.subjectCode} onChange={(e) => setForm({ ...form, subjectCode: e.target.value })}
              placeholder="opcional" className={inputCls} />
          </Field>
          <Button type="submit" variant="primary" disabled={create.isPending}>Adicionar</Button>
        </form>
      </Card>

      {isLoading ? <div className="skeleton h-40" />
        : (list ?? []).length === 0 ? <EmptyState>Nada na agenda ainda — adicione sua próxima prova ou entrega.</EmptyState>
        : visible.length === 0 ? <EmptyState>Nenhum item com esse filtro.</EmptyState>
        : BUCKETS.map(({ key, label, hint }) => grouped[key].length > 0 && (
          <Card key={key}>
            <h3 className="section-label">
              {label} <span className="text-subtle-foreground font-normal normal-case">— {grouped[key].length}{hint && ` · ${hint}`}</span>
            </h3>
            <ul className="flex flex-col gap-2.5">
              {grouped[key].map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3">
                  <Chip tone={kindMeta(t.kind).tone}>{kindMeta(t.kind).label}</Chip>
                  <span className={cn("min-w-[220px] flex-1", t.done && "text-muted-foreground line-through")}>
                    <b className="font-medium">{t.title}</b>
                    {t.subjectCode && <Badge className="ml-2">{t.subjectCode}</Badge>}
                  </span>
                  <span className={cn("min-w-[120px] text-sm", key === "atrasadas" ? "text-lock" : "text-muted-foreground")}>
                    {t.dueAt ? fmtDate.format(new Date(t.dueAt)) : "sem prazo"}
                  </span>
                  <Button size="sm" onClick={() => toggle.mutate(t)}>{t.done ? "Reabrir" : "Concluir"}</Button>
                  <Button size="sm" variant="danger" onClick={() => remove.mutate(t.id)}>Remover</Button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
    </div>
  );
}
