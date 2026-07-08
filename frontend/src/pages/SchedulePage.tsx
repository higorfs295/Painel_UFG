// Cronograma (RF-10/11/12): cenários, disciplinas com código SIGAA (validado no servidor) e pintura da grade.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schedules } from "../api/endpoints";
import { useApp } from "../store/app";
import { parseSIGAA, SLOTS } from "../lib/sigaa";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

const DAYS = [
  { n: 2, label: "Seg" }, { n: 3, label: "Ter" }, { n: 4, label: "Qua" },
  { n: 5, label: "Qui" }, { n: 6, label: "Sex" }, { n: 7, label: "Sáb" },
];
const PAINT = [
  { key: "estudo", label: "Estudo", color: "#6FB3E8" },
  { key: "trabalho", label: "Trabalho", color: "#E9B45A" },
  { key: "pessoal", label: "Pessoal", color: "#B08CFF" },
  { key: "livre", label: "Livre", color: "#4FD6A9" },
];
const COLORS = ["#6FB3E8", "#E9B45A", "#B08CFF", "#4FD6A9", "#E06C6C", "#8FA3B2"];

export default function SchedulePage() {
  const enrollmentId = useApp((s) => s.enrollmentId)!;
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paintCat, setPaintCat] = useState(PAINT[0].key);
  const [disc, setDisc] = useState({ name: "", sigla: "", hours: 0, docente: "", sigaaCode: "", color: COLORS[0] });
  const [discErr, setDiscErr] = useState("");

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios", enrollmentId], queryFn: () => schedules.list(enrollmentId), enabled: !!enrollmentId,
  });
  useEffect(() => {
    if (scenarios && scenarios.length && !scenarios.find((s) => s.id === activeId)) setActiveId(scenarios[0]?.id ?? null);
  }, [scenarios, activeId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["scenarios", enrollmentId] });
  const createScenario = useMutation({ mutationFn: (name: string) => schedules.create(enrollmentId, name), onSuccess: (s) => { invalidate(); setActiveId(s.id); } });
  const delScenario = useMutation({ mutationFn: (id: string) => schedules.remove(id), onSuccess: () => { invalidate(); setActiveId(null); } });
  const addDisc = useMutation({
    mutationFn: () => schedules.addDiscipline(activeId!, { ...disc, docente: disc.docente || undefined }),
    onSuccess: () => { invalidate(); setDisc({ name: "", sigla: "", hours: 0, docente: "", sigaaCode: "", color: COLORS[0] }); setDiscErr(""); },
    onError: () => setDiscErr("Código SIGAA inválido (ex.: 24M12 = seg/qua, matutino, aulas 1–2). Verifique."),
  });
  const delDisc = useMutation({ mutationFn: (v: { sid: string; did: string }) => schedules.removeDiscipline(v.sid, v.did), onSuccess: invalidate });
  const paint = useMutation({ mutationFn: (v: { cellKey: string; category: string }) => schedules.paint(activeId!, v.cellKey, v.category), onSuccess: invalidate });

  const active = scenarios?.find((s) => s.id === activeId) ?? null;

  // ocupação da grade: cellKey -> { sigla, color }
  const occupancy = useMemo(() => {
    const map = new Map<string, { sigla: string; color: string }>();
    active?.disciplines.forEach((d) => {
      parseSIGAA(d.sigaaCode).slots.forEach((slot) => map.set(slot, { sigla: d.sigla, color: d.color }));
    });
    return map;
  }, [active]);
  const paintMap = useMemo(() => {
    const map = new Map<string, string>();
    active?.paints.forEach((p) => map.set(p.cellKey, p.category));
    return map;
  }, [active]);

  function clickCell(cellKey: string) {
    if (occupancy.has(cellKey)) return; // célula com aula não recebe pintura
    const current = paintMap.get(cellKey);
    paint.mutate({ cellKey, category: current === paintCat ? "" : paintCat }); // repintar mesma cor = limpar
  }
  const catColor = (cat: string) => PAINT.find((p) => p.key === cat)?.color ?? "var(--panel2)";

  return (
    <div className="stack">
      <h1>Cronograma</h1>

      <Card tight>
        <div className="row wrap spread">
          <div className="row wrap" style={{ gap: 6 }}>
            {scenarios?.map((s) => (
              <Button key={s.id} size="sm" variant={s.id === activeId ? "prim" : "default"} onClick={() => setActiveId(s.id)}>{s.name}</Button>
            ))}
            {(!scenarios || scenarios.length === 0) && <span className="mut">Nenhum cenário ainda.</span>}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Button size="sm" onClick={() => { const n = prompt("Nome do cenário:"); if (n) createScenario.mutate(n); }}>+ Cenário</Button>
            {active && <Button size="sm" variant="warn" onClick={() => { if (confirm(`Excluir "${active.name}"?`)) delScenario.mutate(active.id); }}>Excluir</Button>}
          </div>
        </div>
      </Card>

      {!active ? (
        <div className="muted-box">Crie um cenário para montar sua grade semanal.</div>
      ) : (
        <>
          <Card>
            <h3>Adicionar disciplina</h3>
            <form className="row wrap" style={{ gap: 10, alignItems: "flex-end" }}
              onSubmit={(e) => { e.preventDefault(); if (disc.name && disc.sigla) addDisc.mutate(); }}>
              <label className="field" style={{ flex: "2 1 200px" }}>Nome<input value={disc.name} onChange={(e) => setDisc({ ...disc, name: e.target.value })} required /></label>
              <label className="field" style={{ width: 90 }}>Sigla<input value={disc.sigla} onChange={(e) => setDisc({ ...disc, sigla: e.target.value })} required /></label>
              <label className="field" style={{ width: 80 }}>CH<input type="number" min={0} value={disc.hours} onChange={(e) => setDisc({ ...disc, hours: Number(e.target.value) })} /></label>
              <label className="field" style={{ flex: "1 1 140px" }}>Docente<input value={disc.docente} onChange={(e) => setDisc({ ...disc, docente: e.target.value })} placeholder="opcional" /></label>
              <label className="field" style={{ width: 130 }}>Código SIGAA<input value={disc.sigaaCode} onChange={(e) => setDisc({ ...disc, sigaaCode: e.target.value })} placeholder="24M12" /></label>
              <label className="field" style={{ width: 60 }}>Cor<input type="color" value={disc.color} onChange={(e) => setDisc({ ...disc, color: e.target.value })} /></label>
              <Button type="submit" variant="prim" disabled={addDisc.isPending}>Adicionar</Button>
            </form>
            {discErr && <div className="err mt">{discErr}</div>}
            {active.disciplines.length > 0 && (
              <div className="row wrap mt" style={{ gap: 8 }}>
                {active.disciplines.map((d) => (
                  <span key={d.id} className="chip" style={{ color: d.color, borderColor: d.color }}>
                    <span className="swatch" style={{ background: d.color }} />{d.sigla} · {d.sigaaCode || "sem horário"}
                    <button className="btn ghost sm" style={{ padding: "0 4px", marginLeft: 4 }}
                      aria-label={`Remover ${d.sigla}`} title={`Remover ${d.sigla}`}
                      onClick={() => delDisc.mutate({ sid: active.id, did: d.id })}>×</button>
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="row wrap spread">
              <h3>Grade semanal</h3>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="mut" style={{ fontSize: ".82rem" }}>Pintar:</span>
                {PAINT.map((p) => (
                  <button key={p.key} className="btn sm" onClick={() => setPaintCat(p.key)}
                    style={{ borderColor: p.color, background: paintCat === p.key ? p.color : "transparent", color: paintCat === p.key ? "#12100A" : "var(--tx)" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="tablewrap mt">
              <table className="sched">
                <thead>
                  <tr><th>Horário</th>{DAYS.map((d) => <th key={d.n}>{d.label}</th>)}</tr>
                </thead>
                <tbody>
                  {SLOTS.map((slot) => (
                    <tr key={slot.id}>
                      <td className="mut" title={slot.lab}>{slot.id}</td>
                      {DAYS.map((d) => {
                        const cellKey = `${d.n}-${slot.id}`;
                        const occ = occupancy.get(cellKey);
                        const pc = paintMap.get(cellKey);
                        if (occ) return <td key={cellKey} className="busy" style={{ background: occ.color, color: "#12100A" }}>{occ.sigla}</td>;
                        return (
                          <td key={cellKey} className="cell" onClick={() => clickCell(cellKey)}
                            style={{ background: pc ? catColor(pc) : undefined, opacity: pc ? 0.85 : 1 }}
                            title={pc ?? "clique para pintar"} />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
