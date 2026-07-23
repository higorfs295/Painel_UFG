"use client";

// Disciplinas — a matriz do curso com o status calculado pelo servidor, filtros e
// as três marcações (aprovada / cursando / simulada).
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useCourseDetail, useProgress, useSetSubject } from "@/hooks/use-progress";
import { Card, Chip, EmptyState, Field, PageHead, Section, Segmented, StatusChip, inputCls } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ExportButton, csvColumnsFrom } from "@/components/ui/export-button";
import Button from "@/components/ui/button";
import { cn, num } from "@/lib/utils";
import type { GraphStatus, SubjectProgress } from "@/lib/api/types";

const STATUS_OPTS = [
  { v: "all", label: "Todos" }, { v: "avail", label: "Disponíveis" }, { v: "co", label: "Co-requisito" },
  { v: "lock", label: "Bloqueadas" }, { v: "done", label: "Concluídas" },
] as const;

const NUC_OPTS = [
  { v: "all", label: "Todos" }, { v: "NC", label: "NC" }, { v: "NE", label: "NE" }, { v: "OPT", label: "Optativas" },
] as const;

const STATUS_LABEL: Record<GraphStatus, string> = {
  done: "Concluída", avail: "Disponível", co: "Co-requisito", lock: "Bloqueada",
};

export default function DisciplinasPage() {
  const { data: prog, isLoading } = useProgress();
  const { data: course } = useCourseDetail();
  const setSubject = useSetSubject();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTS)[number]["v"]>("all");
  const [nucleus, setNucleus] = useState<(typeof NUC_OPTS)[number]["v"]>("all");
  const [gradeFor, setGradeFor] = useState<{ subjectId: string; name: string } | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: "", absences: "", term: "" });

  // o progresso traz `seq`; as mutações precisam do id real da disciplina
  const idBySeq = useMemo(() => {
    const m = new Map<number, string>();
    course?.subjects.forEach((s) => m.set(s.seq, s.id));
    return m;
  }, [course]);

  const rows = useMemo(() => {
    if (!prog) return [];
    const needle = q.trim().toLowerCase();
    return prog.subjects.filter((s) =>
      (status === "all" || s.status === status) &&
      // "OPT" é grupo de optativa (groupOpt > 0), não um núcleo do enum — daí o caso à parte
      (nucleus === "all" || (nucleus === "OPT" ? s.groupOpt > 0 : s.nucleus === nucleus && s.groupOpt === 0)) &&
      (!needle || s.name.toLowerCase().includes(needle) || s.code.toLowerCase().includes(needle)));
  }, [prog, q, status, nucleus]);

  function mark(s: SubjectProgress, state: "APPROVED" | "ENROLLED" | "SIMULATED" | null) {
    const id = idBySeq.get(s.seq);
    if (!id) return;
    setSubject.mutate({ subjectId: id, state });
  }

  function saveGrade() {
    if (!gradeFor) return;
    setSubject.mutate(
      {
        subjectId: gradeFor.subjectId, state: "APPROVED",
        detail: {
          grade: gradeForm.grade === "" ? null : Number(gradeForm.grade),
          absences: gradeForm.absences === "" ? null : Number(gradeForm.absences),
          term: gradeForm.term.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Nota lançada.");
          setGradeFor(null);
          setGradeForm({ grade: "", absences: "", term: "" });
        },
        onError: () => toast.error("Verifique os valores (nota 0–10, período AAAA.S)."),
      },
    );
  }

  const columns: Column<SubjectProgress>[] = [
    { header: "#", cell: (s) => <span className="text-subtle-foreground">{s.seq}</span>, value: (s) => s.seq },
    { header: "Código", cell: (s) => <span className="text-muted-foreground font-mono text-xs">{s.code}</span>, value: (s) => s.code },
    {
      header: "Disciplina",
      cell: (s) => (
        <span className="flex items-center gap-2">
          {s.name}
          {s.groupOpt > 0 && <Chip>optativa</Chip>}
        </span>
      ),
      value: (s) => s.name,
    },
    { header: "CH", cell: (s) => `${s.hours}h`, value: (s) => s.hours },
    {
      header: "Núcleo", cell: (s) => <span className="text-muted-foreground">{s.groupOpt > 0 ? "OPT" : s.nucleus}</span>,
      value: (s) => (s.groupOpt > 0 ? "Optativa" : s.nucleus),
    },
    {
      header: "Situação", cell: (s) => <StatusChip status={s.status} state={s.state} />,
      value: (s) => STATUS_LABEL[s.status],
    },
    {
      header: "Ações", align: "right",
      value: (s) => s.state ?? "",
      cell: (s) => {
        const id = idBySeq.get(s.seq);
        const busy = !id || setSubject.isPending;
        return (
          <div className="flex flex-wrap justify-end gap-1.5">
            {(["APPROVED", "ENROLLED", "SIMULATED"] as const).map((state) => (
              <Button key={state} size="sm" disabled={busy}
                variant={s.state === state ? "primary" : "default"}
                onClick={() => mark(s, state)}>
                {state === "APPROVED" ? "Aprovada" : state === "ENROLLED" ? "Cursando" : "Simular"}
              </Button>
            ))}
            {s.state === "APPROVED" && id && (
              <Button size="sm" onClick={() => { setGradeFor({ subjectId: id, name: s.name }); setGradeForm({ grade: "", absences: "", term: "" }); }}>
                Nota
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy || !s.state} onClick={() => mark(s, null)}>Limpar</Button>
          </div>
        );
      },
    },
  ];

  if (isLoading || !prog) {
    return (
      <div className="flex flex-col gap-5">
        <div className="skeleton h-16 w-72" />
        <div className="skeleton h-20" />
        <div className="skeleton h-96" />
      </div>
    );
  }

  const projecting = prog.projected.totals.hours !== prog.totals.hours;

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="matriz curricular" title="Disciplinas" />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou código…"
              aria-label="Buscar disciplina" className={cn(inputCls, "min-w-[240px]")} />
            <Segmented label="Filtrar por situação" value={status} onChange={setStatus} options={[...STATUS_OPTS]} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-muted-foreground text-sm">Oficial: <b className="text-foreground">{num(prog.totals.hours)}h</b></span>
            {projecting && <Chip tone="sim">Projetado: {num(prog.projected.totals.hours)}h</Chip>}
            <ExportButton name="disciplinas" rows={rows} columns={csvColumnsFrom(columns)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="section-label !mb-0">Núcleo</span>
          <Segmented label="Filtrar por núcleo" value={nucleus} onChange={setNucleus} options={[...NUC_OPTS]} />
        </div>
      </Card>

      {gradeFor && (
        <Section title={`Lançar nota — ${gradeFor.name}`}
          action={<Button variant="ghost" size="sm" onClick={() => setGradeFor(null)}>Cancelar</Button>}>
          <form className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => { e.preventDefault(); saveGrade(); }}>
            <Field label="Nota (0–10)" className="w-32">
              <input type="number" min={0} max={10} step="0.1" value={gradeForm.grade}
                onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })} className={inputCls} placeholder="8.5" />
            </Field>
            <Field label="Faltas" className="w-28">
              <input type="number" min={0} value={gradeForm.absences}
                onChange={(e) => setGradeForm({ ...gradeForm, absences: e.target.value })} className={inputCls} placeholder="0" />
            </Field>
            <Field label="Período" className="w-32">
              <input value={gradeForm.term} onChange={(e) => setGradeForm({ ...gradeForm, term: e.target.value })}
                className={inputCls} placeholder="2024.1" />
            </Field>
            <Button type="submit" variant="primary" disabled={setSubject.isPending}>Salvar</Button>
          </form>
        </Section>
      )}

      <Card>
        <DataTable rows={rows} columns={columns} keyOf={(s) => String(s.seq)}
          empty={<EmptyState>Nenhuma disciplina com esse filtro.</EmptyState>} />
      </Card>
    </div>
  );
}
