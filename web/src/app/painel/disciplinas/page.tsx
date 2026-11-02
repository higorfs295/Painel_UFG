"use client";

// Disciplinas — a matriz do curso no padrão "Details" do tremorlabs/template-dashboard:
// DataTable (TanStack) com busca, filtros, ordenação, paginação, ações por linha e a
// barra de comandos em lote (marcar várias de uma vez). O status vem do servidor
// (concluída / disponível / co-requisito / bloqueada); as marcações são as três de sempre.
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { RiDownloadLine, RiMoreFill, RiStickyNoteLine } from "@remixicon/react";
import { keys, useCourseDetail, useEnrollmentId, useNotes, useProgress, useSetSubject } from "@/hooks/use-progress";
import { me } from "@/lib/api/endpoints";
import { downloadCSV } from "@/lib/csv";
import { Segmented, StatusChip } from "@/components/ui";
import { Badge } from "@/components/tremor/Badge";
import { Button } from "@/components/tremor/Button";
import { Checkbox } from "@/components/tremor/Checkbox";
import {
  CommandBar, CommandBarBar, CommandBarCommand, CommandBarSeperator, CommandBarValue,
} from "@/components/tremor/CommandBar";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/tremor/Dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/tremor/Dropdown";
import { Input } from "@/components/tremor/Input";
import { Label } from "@/components/tremor/Label";
import { Searchbar } from "@/components/tremor/Searchbar";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { SubjectDrawer } from "@/components/subject-drawer";
import { num } from "@/lib/utils";
import type { GraphStatus, SubjectProgress, SubjectState } from "@/lib/api/types";

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
const STATE_LABEL: Record<SubjectState, string> = { APPROVED: "Aprovada", ENROLLED: "Cursando", SIMULATED: "Simular" };

const col = createColumnHelper<SubjectProgress>();

export default function DisciplinasPage() {
  const { data: prog, isLoading } = useProgress();
  const { data: course } = useCourseDetail();
  const { data: notes } = useNotes();
  const enrollmentId = useEnrollmentId();
  const setSubject = useSetSubject();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTS)[number]["v"]>("all");
  const [nucleus, setNucleus] = useState<(typeof NUC_OPTS)[number]["v"]>("all");
  const [openSeq, setOpenSeq] = useState<number | null>(null);
  const [gradeFor, setGradeFor] = useState<{ subjectId: string; name: string } | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: "", absences: "", term: "" });
  const [bulkBusy, setBulkBusy] = useState(false);

  // o progresso traz `seq`; as mutações precisam do id real da disciplina
  const idBySeq = useMemo(() => new Map(course?.subjects.map((s) => [s.seq, s.id]) ?? []), [course]);
  const notedSeqs = useMemo(() => new Set(notes?.map((n) => n.seq) ?? []), [notes]);

  const rows = useMemo(() => {
    if (!prog) return [];
    const needle = q.trim().toLowerCase();
    return prog.subjects.filter((s) =>
      (status === "all" || s.status === status) &&
      // "OPT" é grupo de optativa (groupOpt > 0), não um núcleo do enum — daí o caso à parte
      (nucleus === "all" || (nucleus === "OPT" ? s.groupOpt > 0 : s.nucleus === nucleus && s.groupOpt === 0)) &&
      (!needle || s.name.toLowerCase().includes(needle) || s.code.toLowerCase().includes(needle)));
  }, [prog, q, status, nucleus]);

  const mark = useCallback((s: SubjectProgress, state: SubjectState | null) => {
    const id = idBySeq.get(s.seq);
    if (!id) return;
    setSubject.mutate({ subjectId: id, state }, { onError: () => toast.error("Não foi possível salvar a marcação.") });
  }, [idBySeq, setSubject]);

  /** Lote: uma requisição por disciplina (a API não tem rota em lote) e UMA revalidação no fim. */
  async function markMany(list: SubjectProgress[], state: SubjectState | null, reset: () => void) {
    if (!enrollmentId || list.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    for (const s of list) {
      const id = idBySeq.get(s.seq);
      if (!id) continue;
      try { await me.setSubject(enrollmentId, id, state); ok++; } catch { /* conta como falha abaixo */ }
    }
    for (const k of [keys.progress(enrollmentId), keys.recs(enrollmentId), keys.history(enrollmentId), keys.achievements(enrollmentId)]) {
      qc.invalidateQueries({ queryKey: k });
    }
    qc.invalidateQueries({ queryKey: ["candidates"] });
    setBulkBusy(false);
    reset();
    const failed = list.length - ok;
    if (failed) toast.error(`${ok} salva(s), ${failed} com erro.`);
    else toast.success(`${ok} disciplina(s) ${state ? `marcada(s) como ${STATE_LABEL[state].toLowerCase()}` : "desmarcada(s)"}.`);
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
        onSuccess: () => { toast.success("Nota lançada."); setGradeFor(null); setGradeForm({ grade: "", absences: "", term: "" }); },
        onError: () => toast.error("Verifique os valores (nota 0–10, período AAAA.S)."),
      },
    );
  }

  const columns = useMemo<ColumnDef<SubjectProgress, any>[]>(() => [
    col.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
          onCheckedChange={() => table.toggleAllPageRowsSelected()}
          className="translate-y-0.5" aria-label="Selecionar todas desta página" />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={() => row.toggleSelected()}
          className="translate-y-0.5" aria-label={`Selecionar ${row.original.name}`} />
      ),
      enableSorting: false,
    }),
    col.accessor("seq", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="#" />,
      cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
      enableSorting: true,
    }),
    col.accessor("code", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() || "—"}</span>,
      enableSorting: true,
    }),
    col.accessor("name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Disciplina" />,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => setOpenSeq(row.original.seq)}
            title="Ver requisitos, o que libera e anotação"
            className="cursor-pointer text-left font-medium text-gray-900 underline-offset-4 hover:underline dark:text-gray-50">
            {row.original.name}
          </button>
          {notedSeqs.has(row.original.seq) && (
            <span title="tem anotação"><RiStickyNoteLine className="size-3.5 text-orange-700 dark:text-orange-400" aria-hidden="true" /><span className="sr-only">(tem anotação)</span></span>
          )}
          {row.original.groupOpt > 0 && <Badge variant="neutral">optativa</Badge>}
        </span>
      ),
      enableSorting: true,
    }),
    col.accessor("hours", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="CH" />,
      cell: ({ getValue }) => <span className="tabular-nums">{getValue()} h</span>,
      enableSorting: true,
      meta: { className: "text-right" },
    }),
    col.accessor((s) => (s.groupOpt > 0 ? "OPT" : s.nucleus), {
      id: "nucleo",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Núcleo" />,
      enableSorting: true,
    }),
    col.accessor("status", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Situação" />,
      cell: ({ row }) => <StatusChip status={row.original.status} state={row.original.state} />,
      enableSorting: true,
    }),
    col.display({
      id: "acoes",
      header: () => <span className="sr-only">Ações</span>,
      meta: { className: "text-right" },
      cell: ({ row }) => {
        const s = row.original;
        const id = idBySeq.get(s.seq);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" aria-label={`Ações de ${s.name}`}
                className="group aspect-square p-1.5 hover:border hover:border-gray-300 data-[state=open]:border-gray-300 data-[state=open]:bg-gray-50 dark:hover:border-gray-700 dark:data-[state=open]:border-gray-700 dark:data-[state=open]:bg-gray-900">
                <RiMoreFill className="size-4 shrink-0 text-gray-500 group-hover:text-gray-700 group-data-[state=open]:text-gray-700 dark:group-hover:text-gray-300 dark:group-data-[state=open]:text-gray-300" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {(["APPROVED", "ENROLLED", "SIMULATED"] as const).map((st) => (
                <DropdownMenuItem key={st} disabled={!id} onSelect={() => mark(s, st)}>
                  {STATE_LABEL[st]}{s.state === st && <span className="ml-auto pl-3 text-xs text-gray-500 dark:text-gray-400">atual</span>}
                </DropdownMenuItem>
              ))}
              {s.state === "APPROVED" && id && (
                <DropdownMenuItem onSelect={() => { setGradeFor({ subjectId: id, name: s.name }); setGradeForm({ grade: "", absences: "", term: "" }); }}>
                  Lançar nota…
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setOpenSeq(s.seq)}>Requisitos e anotação…</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!s.state} onSelect={() => mark(s, null)} className="text-red-600 dark:text-red-500">
                Limpar marcação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ], [idBySeq, notedSeqs, mark]);

  if (isLoading || !prog) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton h-7 w-40" />
        <div className="skeleton h-9" />
        <div className="skeleton h-96" />
      </div>
    );
  }

  const projecting = prog.projected.totals.hours !== prog.totals.hours;
  const filtered = q.trim() !== "" || status !== "all" || nucleus !== "all";

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-x-6">
      <div className="flex w-full flex-col gap-2 sm:w-fit sm:flex-row sm:flex-wrap sm:items-center">
        <Searchbar type="search" placeholder="Buscar por nome ou código…" value={q} onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar disciplina" className="w-full sm:max-w-[250px] sm:[&>input]:h-[30px]" />
        <Segmented label="Filtrar por situação" value={status} onChange={setStatus} options={[...STATUS_OPTS]} />
        <Segmented label="Filtrar por núcleo" value={nucleus} onChange={setNucleus} options={[...NUC_OPTS]} />
        {filtered && (
          <Button variant="ghost" onClick={() => { setQ(""); setStatus("all"); setNucleus("all"); }}
            className="border border-gray-200 px-2 font-semibold text-orange-700 sm:border-none sm:py-1 dark:border-gray-800 dark:text-orange-400">
            Limpar filtros
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Oficial <span className="font-medium text-gray-900 tabular-nums dark:text-gray-50">{num(prog.totals.hours)} h</span>
          {projecting && <> · projetado <span className="font-medium text-gray-900 tabular-nums dark:text-gray-50">{num(prog.projected.totals.hours)} h</span></>}
        </span>
        <Button variant="secondary" className="gap-x-2 px-2 py-1.5 text-sm sm:text-xs" disabled={rows.length === 0}
          onClick={() => downloadCSV("disciplinas", rows, [
            { header: "#", value: (s) => s.seq }, { header: "Código", value: (s) => s.code },
            { header: "Disciplina", value: (s) => s.name }, { header: "CH", value: (s) => s.hours },
            { header: "Núcleo", value: (s) => (s.groupOpt > 0 ? "Optativa" : s.nucleus) },
            { header: "Situação", value: (s) => STATUS_LABEL[s.status] },
            { header: "Marcação", value: (s) => s.state ?? "" },
          ])}>
          <RiDownloadLine className="size-4 shrink-0" aria-hidden="true" /> Exportar
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <h1>Disciplinas</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Clique numa linha para selecionar e marcar várias de uma vez; clique no nome para ver requisitos e anotação.
      </p>
      <div className="mt-4 sm:mt-6 lg:mt-10">
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(s) => String(s.seq)}
          toolbar={toolbar}
          empty="Nenhuma disciplina com esse filtro."
          bulk={({ rows: sel, reset }) => (
            <CommandBar open={sel.length > 0}>
              <CommandBarBar>
                <CommandBarValue>{sel.length} selecionada(s)</CommandBarValue>
                <CommandBarSeperator />
                <CommandBarCommand label="Aprovada" disabled={bulkBusy} shortcut={{ shortcut: "a" }}
                  action={() => markMany(sel.map((r) => r.original), "APPROVED", reset)} />
                <CommandBarSeperator />
                <CommandBarCommand label="Cursando" disabled={bulkBusy} shortcut={{ shortcut: "c" }}
                  action={() => markMany(sel.map((r) => r.original), "ENROLLED", reset)} />
                <CommandBarSeperator />
                <CommandBarCommand label="Simular" disabled={bulkBusy} shortcut={{ shortcut: "s" }}
                  action={() => markMany(sel.map((r) => r.original), "SIMULATED", reset)} />
                <CommandBarSeperator />
                <CommandBarCommand label="Limpar" disabled={bulkBusy} shortcut={{ shortcut: "l" }}
                  action={() => markMany(sel.map((r) => r.original), null, reset)} />
                <CommandBarSeperator />
                <CommandBarCommand label="Cancelar" shortcut={{ shortcut: "Escape", label: "esc" }} action={reset} />
              </CommandBarBar>
            </CommandBar>
          )}
        />
      </div>

      <Dialog open={!!gradeFor} onOpenChange={(v) => { if (!v) setGradeFor(null); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(e) => { e.preventDefault(); saveGrade(); }}>
            <DialogHeader>
              <DialogTitle>Lançar nota</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-6">{gradeFor?.name}</DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="nota">Nota (0–10)</Label>
                <Input id="nota" type="number" min={0} max={10} step="0.1" placeholder="8,5" className="mt-2"
                  value={gradeForm.grade} onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="faltas">Faltas</Label>
                <Input id="faltas" type="number" min={0} placeholder="0" className="mt-2"
                  value={gradeForm.absences} onChange={(e) => setGradeForm({ ...gradeForm, absences: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="periodo">Período</Label>
                <Input id="periodo" placeholder="2024.1" className="mt-2"
                  value={gradeForm.term} onChange={(e) => setGradeForm({ ...gradeForm, term: e.target.value })} />
              </div>
            </div>
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <DialogClose asChild><Button variant="secondary" className="w-full sm:w-fit">Cancelar</Button></DialogClose>
              <Button type="submit" className="w-full sm:w-fit" isLoading={setSubject.isPending} loadingText="Salvando…">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SubjectDrawer seq={openSeq} onClose={() => setOpenSeq(null)} onNavigate={setOpenSeq} />
    </>
  );
}
