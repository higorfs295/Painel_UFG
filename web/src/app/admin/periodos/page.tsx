"use client";

// Admin · Períodos (RF-20 v2, v12): calendário acadêmico global e agendável, agora com a linha
// do tempo desenhada. Cada entrada é uma VIRADA: naquela data começa um período letivo (TERM)
// ou as férias (BREAK). Ex.: 06/07 começam as férias; 10/08 começa o 2026.2. Vale para todos.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { RiCalendar2Line, RiCalendarEventLine, RiDeleteBinLine, RiSunLine, RiBookOpenLine } from "@remixicon/react";
import { admin } from "@/lib/api/endpoints";
import { PageBanner } from "@/components/fx/page-banner";
import { Panel, Pill } from "@/components/admin/panel";
import { Button } from "@/components/tremor/Button";
import { Input } from "@/components/tremor/Input";
import { Label } from "@/components/tremor/Label";
import { Segmented } from "@/components/ui";
import { cx, fmtDate } from "@/lib/utils";
import type { AcademicPeriodEntry } from "@/lib/api/types";

const TERM_RE = /^\d{4}\.[12]$/;
const DAY = 86_400_000;
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });

/** Faixa horizontal: cada virada vira um segmento até a próxima; o "agora" é uma agulha. */
function Timeline({ entries }: { entries: AcademicPeriodEntry[] }) {
  if (entries.length === 0) return null;
  const now = Date.now();
  const starts = entries.map((e) => new Date(e.startsAt).getTime());
  const begin = Math.min(starts[0]!, now - 30 * DAY);
  const last = starts.at(-1)!;
  const end = Math.max(last + 120 * DAY, now + 60 * DAY);
  const pos = (t: number) => ((t - begin) / (end - begin)) * 100;
  const months: number[] = [];
  for (let d = new Date(begin); d.getTime() < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    if (d.getTime() >= begin) months.push(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
  }
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="relative min-w-[640px] pt-6 pb-8">
        <div className="relative h-11 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
          {entries.map((e, i) => {
            const from = starts[i]!, to = starts[i + 1] ?? end;
            const term = e.type === "TERM";
            return (
              <div key={e.id} title={`${term ? e.term : "Férias"} — a partir de ${fmtDate.format(new Date(from))}`}
                className={cx("bar-grow absolute inset-y-0 flex items-center overflow-hidden border-l-2 border-white px-2 text-xs font-semibold whitespace-nowrap dark:border-gray-950",
                  term ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200" : "hatch bg-violet-50 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200")}
                style={{ left: `${pos(from)}%`, width: `${pos(to) - pos(from)}%`, animationDelay: `${i * 80}ms` }}>
                <span className={cx("rounded-sm px-1", !term && "bg-violet-50/90 dark:bg-gray-950/70")}>{term ? e.term : "férias"}</span>
              </div>
            );
          })}
        </div>
        {/* agulha do "agora" */}
        <div className="pointer-events-none absolute top-1 bottom-6 w-0.5 rounded-full bg-brand-600 dark:bg-brand-400" style={{ left: `${pos(now)}%` }} aria-hidden="true">
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-brand-700 px-1.5 py-0.5 text-[0.6rem] font-semibold text-white dark:bg-brand-400 dark:text-gray-950">hoje</span>
        </div>
        {/* régua de meses */}
        <div className="absolute inset-x-0 bottom-0 h-6" aria-hidden="true">
          {months.map((m) => (
            <span key={m} className="absolute top-0 border-l border-dashed border-gray-300 pl-1 text-[0.6rem] text-gray-500 dark:border-gray-700 dark:text-gray-400" style={{ left: `${pos(m)}%` }}>
              {monthFmt.format(new Date(m))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminPeriodosPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: "TERM" as "TERM" | "BREAK", term: "", date: "" });
  const periods = useQuery({ queryKey: ["admin-periods"], queryFn: admin.periods });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["admin-periods"] }); qc.invalidateQueries({ queryKey: ["me"] }); };

  const add = useMutation({
    mutationFn: () => admin.addPeriod({
      type: form.type, term: form.type === "TERM" ? form.term.trim() : null,
      startsAt: new Date(`${form.date}T00:00:00`).toISOString(), // meia-noite local
    }),
    onSuccess: () => { setForm({ type: "TERM", term: "", date: "" }); invalidate(); toast.success("Virada agendada."); },
    onError: () => toast.error("Não foi possível agendar. Confira o formato (AAAA.S) e a data."),
  });
  const remove = useMutation({ mutationFn: (id: string) => admin.removePeriod(id), onSuccess: () => { invalidate(); toast.success("Entrada removida."); } });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.type === "TERM" && !TERM_RE.test(form.term.trim())) { toast.error("Período letivo exige o rótulo no formato AAAA.S (ex.: 2026.2)."); return; }
    if (!form.date) { toast.error("Escolha a data de início."); return; }
    add.mutate();
  }

  const now = Date.now();
  const entries = periods.data?.entries ?? [];
  const currentId = [...entries].reverse().find((e) => new Date(e.startsAt).getTime() <= now)?.id;
  const current = periods.data?.current;
  const daysTo = current?.nextStartsAt ? Math.max(0, Math.ceil((new Date(current.nextStartsAt).getTime() - now) / DAY)) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageBanner eyebrow="Calendário" icon={RiCalendar2Line} title="Períodos letivos" tone="emerald"
        description="O calendário vale para todos: define o período que aparece no topo do painel de cada aluno e o que conta como “cursando agora”. Datas passadas são aceitas — é assim que se fixa o período vigente."
        aside={current && (
          <div className="flex items-center gap-4">
            <div className="grid size-20 place-items-center rounded-2xl bg-emerald-700 text-white shadow-md dark:bg-emerald-400 dark:text-gray-950">
              {current.onBreak ? <RiSunLine className="size-8" aria-hidden="true" /> : <span className="text-lg font-bold">{current.label}</span>}
            </div>
            <div className="text-sm">
              <p className="font-semibold text-gray-900 dark:text-gray-50">{current.onBreak ? "Férias" : `Período ${current.label}`}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{current.source === "calendar" ? "pelo calendário" : "sugerido pelo mês (sem calendário)"}</p>
              {daysTo !== null && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{current.nextTerm} em <b>{daysTo}</b> dia(s)</p>}
            </div>
          </div>
        )}
      />

      <Panel icon={RiCalendarEventLine} tone="emerald" id="linha" title="Linha do tempo" description="verde = aulas · hachurado = férias · a agulha marca hoje">
        {periods.isLoading ? <div className="skeleton h-24" /> : entries.length === 0
          ? <p className="text-sm text-gray-500 dark:text-gray-400">Sem viradas agendadas — o sistema sugere o período pelo mês (mar–jul = .1, ago–dez = .2).</p>
          : <Timeline entries={entries} />}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-2" icon={RiCalendar2Line} tone="blue" id="agendar" title="Agendar virada">
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <Segmented label="Tipo de virada" value={form.type} onChange={(v) => setForm({ ...form, type: v })}
              options={[{ v: "TERM", label: "Começa um período" }, { v: "BREAK", label: "Começam as férias" }]} />
            {form.type === "TERM" && (
              <div><Label htmlFor="per-rotulo">Rótulo</Label>
                <Input id="per-rotulo" className="mt-2" placeholder="2027.1" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} /></div>
            )}
            <div><Label htmlFor="per-data">Começa em</Label>
              <Input id="per-data" type="date" className="mt-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Uma virada por data: agendar de novo na mesma data substitui a anterior.</p>
            <Button type="submit" className="w-fit" isLoading={add.isPending}>Agendar</Button>
          </form>
        </Panel>
        <Panel className="lg:col-span-3" icon={RiBookOpenLine} tone="violet" id="entradas" title="Entradas" description={`${entries.length} virada(s)`} bodyClassName="p-0">
          {entries.length === 0 ? <p className="p-5 text-sm text-gray-500 dark:text-gray-400">Nenhuma.</p> : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-900">
              {[...entries].reverse().map((e) => {
                const past = new Date(e.startsAt).getTime() <= now;
                return (
                  <li key={e.id} className={cx("flex items-center gap-3 px-5 py-3", e.id === currentId && "bg-emerald-50/60 dark:bg-emerald-500/10")}>
                    <span aria-hidden="true" className={cx("grid size-9 shrink-0 place-items-center rounded-lg", e.type === "TERM" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300")}>
                      {e.type === "TERM" ? <RiBookOpenLine className="size-4" /> : <RiSunLine className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{e.type === "TERM" ? `Começa ${e.term}` : "Começam as férias"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate.format(new Date(e.startsAt))}</p>
                    </div>
                    {e.id === currentId ? <Pill tone="emerald">vigente</Pill> : past ? <Pill tone="gray">passou</Pill> : <Pill tone="blue">agendada</Pill>}
                    <Button variant="ghost" className="px-2 text-red-700 dark:text-red-400" aria-label={`Remover virada de ${fmtDate.format(new Date(e.startsAt))}`} onClick={() => remove.mutate(e.id)}>
                      <RiDeleteBinLine className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
