// RF-25 — Agenda: provas, trabalhos e entregas com prazo. Agrupa por urgência
// (atrasadas / próximos 7 dias / depois / concluídas) para dar foco ao que importa.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { planner } from "../api/endpoints";
import { useApp } from "../store/app";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import type { StudyTask, TaskKind } from "../api/types";

const KINDS: { v: TaskKind; label: string; chip: string }[] = [
  { v: "PROVA", label: "Prova", chip: "lock" },
  { v: "TRABALHO", label: "Trabalho", chip: "sim" },
  { v: "ENTREGA", label: "Entrega", chip: "avail" },
  { v: "OUTRO", label: "Outro", chip: "co" },
];
const kindMeta = (v: TaskKind) => KINDS.find((k) => k.v === v) ?? KINDS[3]!;
const fmtDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

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

export default function TasksPage() {
  const enrollmentId = useApp((s) => s.enrollmentId)!;
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", kind: "PROVA" as TaskKind, dueAt: "", subjectCode: "" });

  const { data: list, isLoading } = useQuery({
    queryKey: ["tasks", enrollmentId], queryFn: () => planner.tasks(enrollmentId), enabled: !!enrollmentId,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks", enrollmentId] });

  const create = useMutation({
    mutationFn: () => planner.addTask(enrollmentId, {
      title: form.title.trim(), kind: form.kind,
      dueAt: form.dueAt ? new Date(`${form.dueAt}T12:00:00`).toISOString() : null,
      subjectCode: form.subjectCode.trim() || null,
    }),
    onSuccess: () => { invalidate(); setForm({ title: "", kind: "PROVA", dueAt: "", subjectCode: "" }); },
  });
  const toggle = useMutation({
    mutationFn: (t: StudyTask) => planner.patchTask(t.id, { done: !t.done }), onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => planner.removeTask(id), onSuccess: invalidate });

  const grouped = useMemo(() => {
    const map: Record<Bucket, StudyTask[]> = { atrasadas: [], semana: [], depois: [], feitas: [] };
    for (const t of list ?? []) map[bucketOf(t)].push(t);
    return map;
  }, [list]);

  const pending = (list ?? []).filter((t) => !t.done).length;
  const late = grouped.atrasadas.length;

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">organização</span>
        <h1>Agenda</h1>
      </header>
      <p className="mut">
        Provas, trabalhos e entregas com prazo. {pending > 0
          ? <>Você tem <b>{pending}</b> pendência(s){late > 0 && <> — <b className="err">{late} atrasada(s)</b></>}.</>
          : "Nada pendente por aqui."}
      </p>

      <Card>
        <h3>Adicionar</h3>
        <form className="row wrap" style={{ gap: 10, alignItems: "flex-end" }}
          onSubmit={(e) => { e.preventDefault(); if (form.title.trim().length >= 2) create.mutate(); }}>
          <label className="field" style={{ flex: "2 1 240px" }}>Título
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={2} placeholder="Prova 1 de Cálculo" />
          </label>
          <label className="field" style={{ width: 150 }}>Tipo
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TaskKind })}>
              {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 170 }}>Prazo
            <input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          </label>
          <label className="field" style={{ width: 130 }}>Disciplina
            <input value={form.subjectCode} onChange={(e) => setForm({ ...form, subjectCode: e.target.value })} placeholder="opcional" />
          </label>
          <Button type="submit" variant="prim" disabled={create.isPending}>Adicionar</Button>
        </form>
      </Card>

      {isLoading ? <div className="spinner" role="status">Carregando agenda…</div> :
        (list ?? []).length === 0 ? (
          <div className="muted-box">Nada na agenda ainda — adicione sua próxima prova ou entrega.</div>
        ) : BUCKETS.map(({ key, label, hint }) => grouped[key].length > 0 && (
          <Card key={key} tight>
            <h3 style={{ padding: "6px 8px 0" }}>
              {label} <span className="mut" style={{ fontWeight: 400 }}>— {grouped[key].length}{hint && ` · ${hint}`}</span>
            </h3>
            <ul className="enr-list" style={{ padding: "0 8px 8px" }}>
              {grouped[key].map((t) => {
                const meta = kindMeta(t.kind);
                return (
                  <li key={t.id} className="row wrap" style={{ gap: 10, alignItems: "center" }}>
                    <span className={`chip ${meta.chip}`}><span className="swatch" />{meta.label}</span>
                    <span style={{ flex: "1 1 220px", textDecoration: t.done ? "line-through" : undefined, opacity: t.done ? .6 : 1 }}>
                      <b>{t.title}</b>
                      {t.subjectCode && <span className="badge" style={{ marginLeft: 6 }}>{t.subjectCode}</span>}
                    </span>
                    <span className={"mut" + (key === "atrasadas" ? " err" : "")} style={{ fontSize: ".82rem", minWidth: 120 }}>
                      {t.dueAt ? fmtDate.format(new Date(t.dueAt)) : "sem prazo"}
                    </span>
                    <Button size="sm" onClick={() => toggle.mutate(t)}>
                      {t.done ? "Reabrir" : "Concluir"}
                    </Button>
                    <Button size="sm" variant="warn" onClick={() => remove.mutate(t.id)}>Remover</Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
    </div>
  );
}
