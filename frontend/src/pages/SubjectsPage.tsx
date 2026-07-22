// Disciplinas: tabela com status calculado, filtros e simulação (APPROVED/SIMULATED/pendente).
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { me, courses } from "../api/endpoints";
import { useApp } from "../store/app";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import ExportButton from "../components/ui/ExportButton";
import { StatusChip } from "../components/ui/Chip";
import type { GraphStatus, SubjectState } from "../api/types";

const STATUS_OPTS: { v: GraphStatus | "all"; label: string }[] = [
  { v: "all", label: "Todos" }, { v: "avail", label: "Disponíveis" }, { v: "co", label: "Co-requisito" },
  { v: "lock", label: "Bloqueadas" }, { v: "done", label: "Concluídas" },
];
// segundo eixo de filtro (RF-14): núcleo comum, específico e as optativas de grupo
const NUC_OPTS = [
  { v: "all", label: "Todos" }, { v: "NC", label: "NC" }, { v: "NE", label: "NE" }, { v: "OPT", label: "Optativas" },
] as const;
type NucFilter = (typeof NUC_OPTS)[number]["v"];

const STATUS_LABEL: Record<string, string> = {
  done: "Concluída", avail: "Disponível", co: "Co-requisito", lock: "Bloqueada",
};

export default function SubjectsPage() {
  const enrollmentId = useApp((s) => s.enrollmentId)!;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<GraphStatus | "all">("all");
  const [nucleus, setNucleus] = useState<NucFilter>("all");

  const { data: prog, isLoading, isError, refetch } = useQuery({
    queryKey: ["progress", enrollmentId], queryFn: () => me.progress(enrollmentId), enabled: !!enrollmentId,
  });

  const invalidateProgress = () => {
    qc.invalidateQueries({ queryKey: ["progress", enrollmentId] });
    qc.invalidateQueries({ queryKey: ["recs", enrollmentId] });
    qc.invalidateQueries({ queryKey: ["history", enrollmentId] });
    qc.invalidateQueries({ queryKey: ["achievements", enrollmentId] });
  };
  const mutate = useMutation({
    mutationFn: ({ subjectId, state }: { subjectId: string; state: SubjectState | null }) =>
      me.setSubject(enrollmentId, subjectId, state),
    onSuccess: invalidateProgress,
  });

  // RF-22: lançamento de nota/faltas/período de uma disciplina aprovada (alimenta o histórico)
  const [gradeFor, setGradeFor] = useState<{ subjectId: string; name: string } | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: "", absences: "", term: "" });
  const saveGrade = useMutation({
    mutationFn: () => me.setSubject(enrollmentId, gradeFor!.subjectId, "APPROVED", {
      grade: gradeForm.grade === "" ? null : Number(gradeForm.grade),
      absences: gradeForm.absences === "" ? null : Number(gradeForm.absences),
      term: gradeForm.term.trim() || null,
    }),
    onSuccess: () => { invalidateProgress(); setGradeFor(null); setGradeForm({ grade: "", absences: "", term: "" }); },
  });

  // precisamos do subjectId real; o progresso traz seq — buscamos o curso para mapear seq->id
  const { data: course } = useQuery({
    queryKey: ["course-subjects", prog?.enrollment.courseId],
    queryFn: async () => {
      const enr = (await me.enrollments()).find((e) => e.id === enrollmentId);
      if (!enr) return null;
      return courses.detail(enr.course.slug);
    },
    enabled: !!prog,
  });
  const idBySeq = useMemo(() => {
    const m = new Map<number, string>();
    course?.subjects.forEach((s) => m.set(s.seq, s.id));
    return m;
  }, [course]);

  const rows = useMemo(() => {
    if (!prog) return [];
    const needle = q.trim().toLowerCase();
    return prog.subjects.filter((s) =>
      (filter === "all" || s.status === filter) &&
      // "OPT" é grupo de optativa (groupOpt > 0), não um núcleo do enum — daí o caso à parte
      (nucleus === "all" || (nucleus === "OPT" ? s.groupOpt > 0 : s.nucleus === nucleus && s.groupOpt === 0)) &&
      (!needle || s.name.toLowerCase().includes(needle) || s.code.toLowerCase().includes(needle)),
    );
  }, [prog, q, filter, nucleus]);

  if (isError) return (
    <div className="muted-box" role="alert">
      Não foi possível carregar as disciplinas.{" "}
      <button className="btn sm" onClick={() => refetch()}>Tentar novamente</button>
    </div>
  );
  if (isLoading || !prog) return <div className="spinner" role="status" aria-live="polite">Carregando disciplinas…</div>;

  const simulating = prog.projected.totals.hours !== prog.totals.hours;

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">matriz curricular</span>
        <h1>Disciplinas</h1>
      </header>

      <Card tight>
        <div className="row wrap spread">
          <div className="row wrap" style={{ gap: 10 }}>
            <input placeholder="Buscar por nome ou código…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
            <div className="seg" role="tablist" aria-label="Filtrar por situação">
              {STATUS_OPTS.map((o) => (
                <button key={o.v} type="button" role="tab" aria-selected={filter === o.v}
                  className={"seg-btn" + (filter === o.v ? " on" : "")}
                  onClick={() => setFilter(o.v)}>{o.label}</button>
              ))}
            </div>
          </div>
          <div className="row wrap" style={{ gap: 14 }}>
            <span className="mut">Oficial: <b>{prog.totals.hours}h</b></span>
            {simulating && <span className="chip sim"><span className="swatch" />Projetado: {prog.projected.totals.hours}h</span>}
            <ExportButton name="disciplinas" rows={rows} columns={[
              { header: "#", value: (s) => s.seq },
              { header: "Código", value: (s) => s.code },
              { header: "Disciplina", value: (s) => s.name },
              { header: "CH", value: (s) => s.hours },
              { header: "Núcleo", value: (s) => (s.groupOpt > 0 ? "Optativa" : s.nucleus) },
              { header: "Situação", value: (s) => STATUS_LABEL[s.status] ?? s.status },
              { header: "Marcação", value: (s) => s.state ?? "" },
            ]} />
          </div>
        </div>
        <div className="row wrap mt" style={{ gap: 8 }}>
          <span className="mut" style={{ fontSize: ".72rem", letterSpacing: ".14em", textTransform: "uppercase" }}>Núcleo</span>
          <div className="seg" role="tablist" aria-label="Filtrar por núcleo">
            {NUC_OPTS.map((o) => (
              <button key={o.v} type="button" role="tab" aria-selected={nucleus === o.v}
                className={"seg-btn" + (nucleus === o.v ? " on" : "")}
                onClick={() => setNucleus(o.v)}>{o.label}</button>
            ))}
          </div>
        </div>
      </Card>

      {/* RF-22: lançamento de nota/faltas/período — alimenta o Histórico e a média global */}
      {gradeFor && (
        <Card>
          <h3>Lançar nota — {gradeFor.name}</h3>
          <form className="row wrap" style={{ gap: 10, alignItems: "flex-end" }}
            onSubmit={(e) => { e.preventDefault(); saveGrade.mutate(); }}>
            <label className="field" style={{ width: 120 }}>Nota (0–10)
              <input type="number" min={0} max={10} step="0.1" value={gradeForm.grade}
                onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })} placeholder="8.5" />
            </label>
            <label className="field" style={{ width: 110 }}>Faltas
              <input type="number" min={0} value={gradeForm.absences}
                onChange={(e) => setGradeForm({ ...gradeForm, absences: e.target.value })} placeholder="0" />
            </label>
            <label className="field" style={{ width: 130 }}>Período
              <input value={gradeForm.term} onChange={(e) => setGradeForm({ ...gradeForm, term: e.target.value })}
                placeholder="2024.1" />
            </label>
            <Button type="submit" variant="prim" disabled={saveGrade.isPending}>Salvar</Button>
            <Button variant="ghost" onClick={() => setGradeFor(null)}>Cancelar</Button>
          </form>
          {saveGrade.isError && <div className="err mt" role="alert">Verifique os valores (nota 0–10, período AAAA.S).</div>}
        </Card>
      )}

      <Card tight>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>#</th><th>Código</th><th>Disciplina</th><th>CH</th><th>Núcleo</th><th>Status</th><th style={{ textAlign: "right" }}>Ações</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const sid = idBySeq.get(s.seq);
                return (
                  <tr key={s.seq}>
                    <td className="dim">{s.seq}</td>
                    <td className="mut">{s.code}</td>
                    <td>{s.name}{s.groupOpt > 0 && <span className="badge" style={{ marginLeft: 6 }}>optativa</span>}</td>
                    <td>{s.hours}h</td>
                    <td className="mut">{s.nucleus}</td>
                    <td><StatusChip status={s.status} state={s.state} /></td>
                    <td>
                      <div className="row wrap" style={{ gap: 6, justifyContent: "flex-end", rowGap: 6 }}>
                        <Button size="sm" variant={s.state === "APPROVED" ? "prim" : "default"} disabled={!sid || mutate.isPending}
                          onClick={() => sid && mutate.mutate({ subjectId: sid, state: "APPROVED" })}>Aprovada</Button>
                        <Button size="sm" variant={s.state === "ENROLLED" ? "prim" : "default"} disabled={!sid || mutate.isPending}
                          onClick={() => sid && mutate.mutate({ subjectId: sid, state: "ENROLLED" })}>Cursando</Button>
                        <Button size="sm" variant={s.state === "SIMULATED" ? "prim" : "default"} disabled={!sid || mutate.isPending}
                          onClick={() => sid && mutate.mutate({ subjectId: sid, state: "SIMULATED" })}>Simular</Button>
                        {s.state === "APPROVED" && sid && (
                          <Button size="sm" onClick={() => { setGradeFor({ subjectId: sid, name: s.name }); setGradeForm({ grade: "", absences: "", term: "" }); }}>
                            Nota
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={!sid || !s.state || mutate.isPending}
                          onClick={() => sid && mutate.mutate({ subjectId: sid, state: null })}>Limpar</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="center mut">Nenhuma disciplina com esse filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
