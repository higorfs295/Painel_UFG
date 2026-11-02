"use client";

// Gaveta de uma disciplina (Disciplinas e Mapa curricular), no Tremor Raw Drawer.
// Reúne situação, requisitos (com o estado de cada um), o que ela libera, as marcações e a
// anotação pessoal (RF-26 — o backend já tinha; a interface não expunha).
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useCourseDetail, useNotes, useProgress, useSaveNote, useSetSubject } from "@/hooks/use-progress";
import { buildGraph, closure } from "@/lib/curriculum-graph";
import { StatusChip } from "@/components/ui";
import { Badge } from "@/components/tremor/Badge";
import { Button } from "@/components/tremor/Button";
import { Divider } from "@/components/tremor/Divider";
import {
  Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle,
} from "@/components/tremor/Drawer";
import { Label } from "@/components/tremor/Label";
import { cx, fmtDate } from "@/lib/utils";
import type { SubjectProgress } from "@/lib/api/types";

const textarea =
  "block w-full resize-y rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 shadow-xs outline-hidden transition " +
  "placeholder:text-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 " +
  "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:placeholder:text-gray-400 dark:focus:border-orange-700 dark:focus:ring-orange-700/30";

export function SubjectDrawer({ seq, onClose, onNavigate }: {
  seq: number | null;
  onClose: () => void;
  /** clicar num requisito/liberada troca a disciplina exibida */
  onNavigate?: (seq: number) => void;
}) {
  const { data: prog } = useProgress();
  const { data: course } = useCourseDetail();
  const { data: notes } = useNotes();
  const setSubject = useSetSubject();
  const saveNote = useSaveNote();

  const graph = useMemo(() => (course ? buildGraph(course) : null), [course]);
  const progBySeq = useMemo(() => new Map(prog?.subjects.map((s) => [s.seq, s]) ?? []), [prog]);

  const subject = seq != null ? graph?.bySeq.get(seq) : undefined;
  const sp = seq != null ? progBySeq.get(seq) : undefined;
  const note = notes?.find((n) => n.subjectId === subject?.id);
  const [draft, setDraft] = useState("");
  useEffect(() => { setDraft(note?.text ?? ""); }, [note?.text, seq]);

  const reqs = seq != null ? graph?.requires.get(seq) ?? [] : [];
  const unl = seq != null ? graph?.unlocks.get(seq) ?? [] : [];
  const miles = seq != null ? graph?.milestones.get(seq) ?? [] : [];
  const chainUp = graph && seq != null ? closure(graph, seq, "up").size : 0;
  const chainDown = graph && seq != null ? closure(graph, seq, "down").size : 0;

  function mark(state: "APPROVED" | "ENROLLED" | "SIMULATED" | null) {
    if (!subject) return;
    setSubject.mutate({ subjectId: subject.id, state }, { onError: () => toast.error("Não foi possível salvar a marcação.") });
  }

  function persistNote() {
    if (!subject) return;
    saveNote.mutate({ subjectId: subject.id, text: draft }, {
      onSuccess: () => toast.success(draft.trim() ? "Anotação salva." : "Anotação removida."),
      onError: () => toast.error("Não foi possível salvar a anotação (máx. 4000 caracteres)."),
    });
  }

  const Row = ({ s, type }: { s: SubjectProgress | undefined; type?: "PRE" | "CO" }) => s ? (
    <li>
      <button type="button" onClick={() => onNavigate?.(s.seq)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-900">
        <span className="w-16 shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400">{s.code || `#${s.seq}`}</span>
        <span className="min-w-0 flex-1 truncate text-gray-900 dark:text-gray-50">{s.name}</span>
        {type === "CO" && <Badge variant="neutral">co</Badge>}
        <StatusChip status={s.status} state={s.state} />
      </button>
    </li>
  ) : null;

  return (
    <Drawer open={seq != null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DrawerContent className="sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{subject?.name ?? "Disciplina"}</DrawerTitle>
          <DrawerDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-mono text-xs">{subject?.code || "sem código"} · #{seq}</span>
            {sp && <StatusChip status={sp.status} state={sp.state} />}
            {subject && <Badge variant="neutral">{subject.hours} h</Badge>}
            {subject && <Badge variant="neutral">{subject.groupOpt > 0 ? `optativa · grupo ${subject.groupOpt}` : subject.nucleus}</Badge>}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-8 py-6">
          <section>
            <h3 className="font-semibold text-gray-900 sm:text-sm dark:text-gray-50">Marcar como</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["APPROVED", "ENROLLED", "SIMULATED"] as const).map((st) => (
                <Button key={st} disabled={setSubject.isPending || !subject}
                  variant={sp?.state === st ? "primary" : "secondary"} className="py-1.5" onClick={() => mark(st)}>
                  {st === "APPROVED" ? "Aprovada" : st === "ENROLLED" ? "Cursando" : "Simular"}
                </Button>
              ))}
              <Button variant="ghost" className="py-1.5" disabled={setSubject.isPending || !sp?.state} onClick={() => mark(null)}>Limpar</Button>
            </div>
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-gray-900 sm:text-sm dark:text-gray-50">Exige</h3>
              <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">{chainUp} na cadeia completa</span>
            </div>
            {reqs.length === 0 && miles.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sem requisitos — pode cursar a qualquer momento.</p>
            ) : (
              <ul className="mt-2">
                {miles.map((m) => {
                  const reached = prog?.milestones.find((x) => x.key === m)?.reached;
                  return (
                    <li key={m} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                      <span className="w-16 font-mono text-xs text-gray-500 dark:text-gray-400">marco</span>
                      <span className="flex-1 text-gray-900 dark:text-gray-50">{m} — horas integralizadas</span>
                      <Badge variant={reached ? "success" : "neutral"}>{reached ? "alcançado" : "pendente"}</Badge>
                    </li>
                  );
                })}
                {reqs.map((e) => <Row key={`${e.from}-${e.type}`} s={progBySeq.get(e.from)} type={e.type} />)}
              </ul>
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-gray-900 sm:text-sm dark:text-gray-50">Libera</h3>
              <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">{chainDown} adiante no total</span>
            </div>
            {unl.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Nenhuma disciplina depende diretamente desta.</p>
            ) : (
              <ul className="mt-2">{unl.map((e) => <Row key={`${e.to}-${e.type}`} s={progBySeq.get(e.to)} type={e.type} />)}</ul>
            )}
          </section>

          <Divider className="my-0" />

          <section>
            <Label htmlFor="nota-disciplina" className="font-semibold">Anotação</Label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Só você vê — professor, bibliografia, dicas da monitoria…
              {note && ` Editada em ${fmtDate.format(new Date(note.updatedAt))}.`}
            </p>
            <textarea id="nota-disciplina" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000}
              rows={5} placeholder="Escreva aqui…" className={cx(textarea, "mt-3")} />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">{draft.length}/4000</span>
              <Button onClick={persistNote} disabled={!subject || draft === (note?.text ?? "")}
                isLoading={saveNote.isPending} loadingText="Salvando…">
                Salvar anotação
              </Button>
            </div>
          </section>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
