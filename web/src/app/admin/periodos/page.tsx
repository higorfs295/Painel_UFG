"use client";

// Admin · Períodos (RF-20 v2): calendário acadêmico global e agendável.
// Cada entrada é uma VIRADA: naquela data começa um período letivo (TERM) ou as férias (BREAK).
// Ex.: 06/07 começam as férias; 10/08 começa o 2026.2. Vale para todos os usuários.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { admin } from "@/lib/api/endpoints";
import { Card, Chip, EmptyState, Field, PageHead, Section, inputCls } from "@/components/ui";
import Button from "@/components/ui/button";
import { IconTrash } from "@/components/ui/icons";
import { cn, fmtDate } from "@/lib/utils";

const TERM_RE = /^\d{4}\.[12]$/;

export default function AdminPeriodosPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: "TERM" as "TERM" | "BREAK", term: "", date: "" });

  const periods = useQuery({ queryKey: ["admin-periods"], queryFn: admin.periods });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-periods"] });
    qc.invalidateQueries({ queryKey: ["me"] }); // o chip de período de todo mundo muda
  };

  const add = useMutation({
    mutationFn: () => admin.addPeriod({
      type: form.type,
      term: form.type === "TERM" ? form.term.trim() : null,
      // meia-noite local — o backend guarda o instante exato da virada
      startsAt: new Date(`${form.date}T00:00:00`).toISOString(),
    }),
    onSuccess: () => { setForm({ type: "TERM", term: "", date: "" }); invalidate(); toast.success("Virada agendada."); },
    onError: () => toast.error("Não foi possível agendar. Confira o formato (AAAA.S) e a data."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => admin.removePeriod(id),
    onSuccess: () => { invalidate(); toast.success("Entrada removida."); },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.type === "TERM" && !TERM_RE.test(form.term.trim())) {
      toast.error("Período letivo exige o rótulo no formato AAAA.S (ex.: 2026.2).");
      return;
    }
    if (!form.date) { toast.error("Escolha a data de início."); return; }
    add.mutate();
  }

  const now = Date.now();
  const entries = periods.data?.entries ?? [];
  // a entrada vigente é a última com startsAt <= agora
  const currentId = [...entries].reverse().find((e) => new Date(e.startsAt).getTime() <= now)?.id;
  const current = periods.data?.current;

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="administração · calendário" title="Períodos" />

      {current && (
        <Card className="border-l-primary border-l-4">
          <span className="eyebrow">agora, para todos</span>
          <p className="font-display mt-1 text-2xl font-semibold tracking-tight">
            {current.onBreak ? "Férias" : current.label}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {current.onBreak
              ? <>próximo período: <b className="text-foreground">{current.nextTerm}</b></>
              : <>depois vem: <b className="text-foreground">{current.nextTerm}</b></>}
            {current.nextStartsAt && <> · virada em {fmtDate.format(new Date(current.nextStartsAt))}</>}
            {current.source === "heuristic" && <> · sem calendário cadastrado, valendo a sugestão automática</>}
          </p>
        </Card>
      )}

      <Section title="Agendar virada">
        <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
          <Field label="Tipo" className="w-44">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "TERM" | "BREAK" })}
              className={inputCls}>
              <option value="TERM">Período letivo</option>
              <option value="BREAK">Férias</option>
            </select>
          </Field>
          {form.type === "TERM" && (
            <Field label="Rótulo (AAAA.S)" className="w-40">
              <input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })}
                placeholder="2026.2" className={inputCls} />
            </Field>
          )}
          <Field label="Começa em" className="w-48">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
          </Field>
          <Button type="submit" variant="primary" disabled={add.isPending}>Agendar</Button>
        </form>
        <p className="text-muted-foreground mt-3 text-sm">
          A virada vale a partir da data escolhida, para todos os usuários — inclusive agendada com
          antecedência.
        </p>
      </Section>

      <Section title="Linha do tempo">
        {entries.length === 0 ? (
          <EmptyState>Nenhuma entrada no calendário — o sistema está sugerindo o período pelo mês.</EmptyState>
        ) : (
          <ol className="relative">
            <span aria-hidden="true" className="bg-border absolute top-2 bottom-2 left-[5px] w-px" />
            {entries.map((e) => {
              const past = new Date(e.startsAt).getTime() <= now;
              const isCurrent = e.id === currentId;
              return (
                <li key={e.id} className={cn("relative flex items-center gap-3 py-2.5 pl-6", past && !isCurrent && "opacity-50")}>
                  <span aria-hidden="true"
                    className={cn("bg-background absolute left-0 size-2.5 rounded-full border-2",
                      isCurrent && "border-primary bg-primary")} />
                  <span className="text-muted-foreground min-w-[128px] font-mono text-xs">
                    {fmtDate.format(new Date(e.startsAt))}
                  </span>
                  <Chip tone={e.type === "BREAK" ? "sim" : "avail"}>
                    {e.type === "BREAK" ? "Férias" : e.term}
                  </Chip>
                  {isCurrent && <span className="text-primary text-xs font-medium">vigente</span>}
                  <Button size="sm" variant="ghost" className="ml-auto" aria-label="Remover entrada"
                    onClick={() => remove.mutate(e.id)}>
                    <IconTrash />
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </div>
  );
}
