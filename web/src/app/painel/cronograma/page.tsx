"use client";

// Cronograma (RF-10/11/12/29): cenários, disciplinas com código SIGAA validado no
// servidor, pintura da grade e o preenchimento automático a partir de cursando/simuladas.
import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { schedules } from "@/lib/api/endpoints";
import { keys, useEnrollmentId, useScenarios } from "@/hooks/use-progress";
import { parseSIGAA, SLOTS } from "@/lib/sigaa";
import { SmartFill } from "@/components/schedule/smart-fill";
import { Card, EmptyState, Field, PageHead, inputCls } from "@/components/ui";
import Button from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
const EMPTY_DISC = { name: "", sigla: "", hours: 0, docente: "", sigaaCode: "", color: COLORS[0]! };

export default function CronogramaPage() {
  const enrollmentId = useEnrollmentId();
  const qc = useQueryClient();
  const { data: scenarios } = useScenarios();

  // `activeId` guarda APENAS a escolha explícita; o fallback é calculado na renderização
  // (um efeito que reescrevia o id fazia o "Excluir" apagar o cenário errado).
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = scenarios?.find((s) => s.id === activeId) ?? scenarios?.[0] ?? null;

  const [disc, setDisc] = useState(EMPTY_DISC);
  const [paintCat, setPaintCat] = useState(PAINT[0]!.key);
  const [newName, setNewName] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: keys.scenarios(enrollmentId!) });

  const createScenario = useMutation({
    mutationFn: (name: string) => schedules.create(enrollmentId!, name),
    onSuccess: (s) => { invalidate(); setActiveId(s.id); setNewName(""); toast.success(`Cenário "${s.name}" criado.`); },
  });
  const delScenario = useMutation({
    mutationFn: (id: string) => schedules.remove(id),
    onSuccess: () => { invalidate(); setActiveId(null); toast.success("Cenário excluído."); },
  });
  const addDisc = useMutation({
    mutationFn: () => schedules.addDiscipline(active!.id, { ...disc, docente: disc.docente || undefined }),
    onSuccess: () => { invalidate(); setDisc(EMPTY_DISC); },
    onError: () => toast.error("Código SIGAA inválido (ex.: 24M12 = seg/qua, matutino, aulas 1–2)."),
  });
  const delDisc = useMutation({
    mutationFn: (v: { sid: string; did: string }) => schedules.removeDiscipline(v.sid, v.did), onSuccess: invalidate,
  });
  const paint = useMutation({
    mutationFn: (v: { cellKey: string; category: string }) => schedules.paint(active!.id, v.cellKey, v.category),
    onSuccess: invalidate,
  });

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
    paint.mutate({ cellKey, category: current === paintCat ? "" : paintCat }); // repintar a mesma = limpar
  }
  const catColor = (cat: string) => PAINT.find((p) => p.key === cat)?.color;

  // Navegação por teclado da grade (padrão ARIA "grid" com roving tabindex).
  const [cursor, setCursor] = useState({ r: 0, c: 0 });
  const gridRef = useRef<HTMLTableSectionElement>(null);
  function moveCursor(r: number, c: number) {
    const rr = Math.max(0, Math.min(SLOTS.length - 1, r));
    const cc = Math.max(0, Math.min(DAYS.length - 1, c));
    setCursor({ r: rr, c: cc });
    gridRef.current?.querySelector<HTMLElement>(`[data-r="${rr}"][data-c="${cc}"]`)?.focus();
  }
  function onGridKey(e: React.KeyboardEvent) {
    // lê a posição da célula realmente focada (DOM), evitando closure defasado
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
        clickCell(`${DAYS[c]!.n}-${SLOTS[r]!.id}`);
        break;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="grade semanal" title="Cronograma" />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {scenarios?.map((s) => (
              <Button key={s.id} size="sm" variant={s.id === active?.id ? "primary" : "default"}
                onClick={() => setActiveId(s.id)}>{s.name}</Button>
            ))}
            {(!scenarios || scenarios.length === 0) && (
              <span className="text-muted-foreground text-sm">Nenhum cenário ainda.</span>
            )}
          </div>
          <form className="flex items-end gap-2"
            onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createScenario.mutate(newName.trim()); }}>
            <Field label="Novo cenário" className="w-44">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Plano 2026.2"
                className={cn(inputCls, "py-1.5 text-sm")} />
            </Field>
            <Button type="submit" size="sm" disabled={!newName.trim() || createScenario.isPending}>+ Cenário</Button>
            {active && (
              <Button size="sm" variant="danger" onClick={() => delScenario.mutate(active.id)}>Excluir</Button>
            )}
          </form>
        </div>
      </Card>

      {!active ? (
        <EmptyState>Crie um cenário para montar sua grade semanal.</EmptyState>
      ) : (
        <>
          {/* o caminho rápido vem primeiro; o formulário manual serve a disciplinas fora da matriz */}
          <SmartFill scenarioId={active.id} enrollmentId={enrollmentId!} />

          <Card>
            <h3 className="section-label">Adicionar manualmente</h3>
            <form className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => { e.preventDefault(); if (disc.name && disc.sigla) addDisc.mutate(); }}>
              <Field label="Nome" className="min-w-[200px] flex-[2]">
                <input value={disc.name} onChange={(e) => setDisc({ ...disc, name: e.target.value })} required className={inputCls} />
              </Field>
              <Field label="Sigla" className="w-24">
                <input value={disc.sigla} onChange={(e) => setDisc({ ...disc, sigla: e.target.value })} required className={inputCls} />
              </Field>
              <Field label="CH" className="w-20">
                <input type="number" min={0} value={disc.hours}
                  onChange={(e) => setDisc({ ...disc, hours: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="Docente" className="min-w-[140px] flex-1">
                <input value={disc.docente} onChange={(e) => setDisc({ ...disc, docente: e.target.value })}
                  placeholder="opcional" className={inputCls} />
              </Field>
              <Field label="Código SIGAA" className="w-36">
                <input value={disc.sigaaCode} onChange={(e) => setDisc({ ...disc, sigaaCode: e.target.value })}
                  placeholder="24M12" className={cn(inputCls, "font-mono")} />
              </Field>
              <Field label="Cor" className="w-20">
                <input type="color" value={disc.color} onChange={(e) => setDisc({ ...disc, color: e.target.value })}
                  className={cn(inputCls, "h-9 p-1")} />
              </Field>
              <Button type="submit" variant="primary" disabled={addDisc.isPending}>Adicionar</Button>
            </form>

            {active.disciplines.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {active.disciplines.map((d) => (
                  <li key={d.id}
                    className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium"
                    style={{ color: d.color, borderColor: d.color }}>
                    <span className="size-1.5 rounded-full" style={{ background: d.color }} />
                    {d.sigla} · {d.sigaaCode || "sem horário"}
                    <button onClick={() => delDisc.mutate({ sid: active.id, did: d.id })}
                      aria-label={`Remover ${d.sigla}`} title={`Remover ${d.sigla}`}
                      className="hover:text-lock cursor-pointer px-0.5">×</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="section-label !mb-0">Grade semanal</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">Pintar:</span>
                {PAINT.map((p) => (
                  <button key={p.key} onClick={() => setPaintCat(p.key)}
                    className="cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                      borderColor: p.color,
                      background: paintCat === p.key ? p.color : "transparent",
                      color: paintCat === p.key ? "#12100A" : undefined,
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-xs" role="grid"
                aria-label="Grade semanal de horários" onKeyDown={onGridKey}>
                <thead>
                  <tr role="row">
                    <th role="columnheader" scope="col" className="border p-1.5">Horário</th>
                    {DAYS.map((d) => (
                      <th key={d.n} role="columnheader" scope="col" className="border p-1.5">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody ref={gridRef}>
                  {SLOTS.map((slot, ri) => (
                    <tr key={slot.id} role="row">
                      <th role="rowheader" scope="row" title={slot.lab}
                        className="text-muted-foreground border p-1.5 font-normal">{slot.id}</th>
                      {DAYS.map((d, ci) => {
                        const cellKey = `${d.n}-${slot.id}`;
                        const occ = occupancy.get(cellKey);
                        const pc = paintMap.get(cellKey);
                        const label = occ
                          ? `${d.label} ${slot.id}: ${occ.sigla}`
                          : `${d.label} ${slot.id}, ${pc ? `pintado ${pc}` : "vazio"}`;
                        return (
                          <td key={cellKey} role="gridcell" data-r={ri} data-c={ci}
                            tabIndex={cursor.r === ri && cursor.c === ci ? 0 : -1}
                            aria-label={label}
                            onFocus={() => setCursor({ r: ri, c: ci })}
                            onClick={() => { setCursor({ r: ri, c: ci }); clickCell(cellKey); }}
                            className={cn("h-7 border p-1.5 text-center transition-colors",
                              occ ? "font-semibold" : "hover:bg-sun/15 cursor-pointer")}
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

            <p className="text-muted-foreground mt-3 text-sm">
              Clique numa célula livre para pintar, ou navegue com as setas do teclado e pinte com Enter/Espaço.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
