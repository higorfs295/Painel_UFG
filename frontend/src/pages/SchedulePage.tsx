// Cronograma (RF-10/11/12): cenários, disciplinas com código SIGAA (validado no servidor) e pintura da grade.
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schedules } from "../api/endpoints";
import { useApp } from "../store/app";
import { parseSIGAA, SLOTS } from "../lib/sigaa";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import SmartFill from "../components/schedule/SmartFill";

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
  // `activeId` guarda APENAS a escolha explícita; o fallback é calculado na hora.
  // (Antes um efeito reescrevia activeId e, com a lista ainda desatualizada logo após criar
  // um cenário, ele voltava para o primeiro da lista — e o "Excluir" apagava o cenário errado.)
  const active = scenarios?.find((s) => s.id === activeId) ?? scenarios?.[0] ?? null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["scenarios", enrollmentId] });
  const createScenario = useMutation({ mutationFn: (name: string) => schedules.create(enrollmentId, name), onSuccess: (s) => { invalidate(); setActiveId(s.id); } });
  const delScenario = useMutation({ mutationFn: (id: string) => schedules.remove(id), onSuccess: () => { invalidate(); setActiveId(null); } });
  const addDisc = useMutation({
    mutationFn: () => schedules.addDiscipline(active!.id, { ...disc, docente: disc.docente || undefined }),
    onSuccess: () => { invalidate(); setDisc({ name: "", sigla: "", hours: 0, docente: "", sigaaCode: "", color: COLORS[0] }); setDiscErr(""); },
    onError: () => setDiscErr("Código SIGAA inválido (ex.: 24M12 = seg/qua, matutino, aulas 1–2). Verifique."),
  });
  const delDisc = useMutation({ mutationFn: (v: { sid: string; did: string }) => schedules.removeDiscipline(v.sid, v.did), onSuccess: invalidate });
  const paint = useMutation({ mutationFn: (v: { cellKey: string; category: string }) => schedules.paint(active!.id, v.cellKey, v.category), onSuccess: invalidate });

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

  // Navegação por teclado da grade (padrão ARIA "grid" com roving tabindex).
  // Uma célula fica no tab order; setas movem o foco; Enter/Espaço pinta a célula focada.
  const [cursor, setCursor] = useState({ r: 0, c: 0 });
  const gridRef = useRef<HTMLTableSectionElement>(null);
  function moveCursor(r: number, c: number) {
    const rr = Math.max(0, Math.min(SLOTS.length - 1, r));
    const cc = Math.max(0, Math.min(DAYS.length - 1, c));
    setCursor({ r: rr, c: cc });
    gridRef.current?.querySelector<HTMLElement>(`[data-r="${rr}"][data-c="${cc}"]`)?.focus();
  }
  function onGridKey(e: React.KeyboardEvent) {
    // lê a posição da célula realmente focada (DOM), evitando closure defasado sob teclas rápidas
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-r]");
    if (!cell) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); moveCursor(r - 1, c); break;
      case "ArrowDown": e.preventDefault(); moveCursor(r + 1, c); break;
      case "ArrowLeft": e.preventDefault(); moveCursor(r, c - 1); break;
      case "ArrowRight": e.preventDefault(); moveCursor(r, c + 1); break;
      case "Home": e.preventDefault(); moveCursor(r, 0); break;
      case "End": e.preventDefault(); moveCursor(r, DAYS.length - 1); break;
      case "Enter": case " ":
        e.preventDefault();
        clickCell(`${DAYS[c].n}-${SLOTS[r].id}`);
        break;
    }
  }

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">grade semanal</span>
        <h1>Cronograma</h1>
      </header>

      <Card tight>
        <div className="row wrap spread">
          <div className="row wrap" style={{ gap: 6 }}>
            {scenarios?.map((s) => (
              <Button key={s.id} size="sm" variant={s.id === active?.id ? "prim" : "default"} onClick={() => setActiveId(s.id)}>{s.name}</Button>
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
          {/* RF-29: o caminho rápido vem primeiro; o formulário manual continua abaixo
              para disciplinas fora da matriz (optativas de outro curso, por exemplo). */}
          <SmartFill scenarioId={active.id} enrollmentId={enrollmentId} />

          <Card>
            <h3>Adicionar manualmente</h3>
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
              <table className="sched" role="grid" aria-label="Grade semanal de horários" onKeyDown={onGridKey}>
                <thead>
                  <tr role="row">
                    <th role="columnheader" scope="col">Horário</th>
                    {DAYS.map((d) => <th key={d.n} role="columnheader" scope="col">{d.label}</th>)}
                  </tr>
                </thead>
                <tbody ref={gridRef}>
                  {SLOTS.map((slot, ri) => (
                    <tr key={slot.id} role="row">
                      <th role="rowheader" scope="row" className="mut" title={slot.lab} style={{ fontWeight: 500 }}>{slot.id}</th>
                      {DAYS.map((d, ci) => {
                        const cellKey = `${d.n}-${slot.id}`;
                        const occ = occupancy.get(cellKey);
                        const pc = paintMap.get(cellKey);
                        const label = occ
                          ? `${d.label} ${slot.id}: ${occ.sigla}`
                          : `${d.label} ${slot.id}, ${pc ? `pintado ${pc}` : "vazio"}`;
                        return (
                          <td key={cellKey} role="gridcell" data-r={ri} data-c={ci}
                            className={occ ? "busy" : "cell"}
                            tabIndex={cursor.r === ri && cursor.c === ci ? 0 : -1}
                            aria-label={label}
                            onFocus={() => setCursor({ r: ri, c: ci })}
                            onClick={() => { setCursor({ r: ri, c: ci }); clickCell(cellKey); }}
                            style={occ
                              ? { background: occ.color, color: "#1B1109" }
                              : { background: pc ? catColor(pc) : undefined, opacity: pc ? 0.85 : 1 }}>
                            {occ ? occ.sigla : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mut" style={{ fontSize: ".8rem", marginTop: 8 }}>
              Clique numa célula livre para pintar, ou navegue com as setas do teclado e pinte com Enter/Espaço.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
