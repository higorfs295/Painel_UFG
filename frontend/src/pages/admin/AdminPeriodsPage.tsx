// Admin · Períodos (RF-20 v2): calendário acadêmico global e agendável.
// Cada entrada é uma VIRADA: naquela data começa um período letivo (TERM) ou as férias (BREAK).
// Ex.: 06/07 começam as férias; 10/08 começa o 2026.2. Vale para todos os usuários.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin } from "../../api/endpoints";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

const TERM_RE = /^\d{4}\.[12]$/;
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export default function AdminPeriodsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: "TERM" as "TERM" | "BREAK", term: "", date: "" });
  const [err, setErr] = useState("");

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
    onSuccess: () => { setForm({ type: "TERM", term: "", date: "" }); setErr(""); invalidate(); },
    onError: () => setErr("Não foi possível agendar. Confira o formato do período (AAAA.S) e a data."),
  });
  const remove = useMutation({ mutationFn: (id: string) => admin.removePeriod(id), onSuccess: invalidate });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (form.type === "TERM" && !TERM_RE.test(form.term.trim())) {
      setErr("Período letivo exige o rótulo no formato AAAA.S (ex.: 2026.2)."); return;
    }
    if (!form.date) { setErr("Escolha a data de início."); return; }
    add.mutate();
  }

  const now = Date.now();
  const entries = periods.data?.entries ?? [];
  // a entrada vigente é a última com startsAt <= agora
  const currentId = [...entries].reverse().find((e) => new Date(e.startsAt).getTime() <= now)?.id;
  const current = periods.data?.current;

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">Administração · calendário</span>
        <h1>Períodos</h1>
      </header>

      {current && (
        <div className="callout">
          <div className="callout-body">
            <span className="eyebrow">Agora, para todos</span>
            <strong className="callout-big">{current.onBreak ? "🌴 Férias" : current.label}</strong>
            <span className="mut">
              {current.onBreak ? <>próximo período: <b>{current.nextTerm}</b></> : <>depois vem: <b>{current.nextTerm}</b></>}
              {current.nextStartsAt && <> · virada em {fmt.format(new Date(current.nextStartsAt))}</>}
              {current.source === "heuristic" && <> · (sem calendário cadastrado — valendo a sugestão automática)</>}
            </span>
          </div>
        </div>
      )}

      <Card>
        <h3>Agendar virada</h3>
        <p className="mut">Na data escolhida começa um <b>período letivo</b> (com rótulo, ex.: 2026.2) ou as{" "}
          <b>férias</b>. Agendar duas vezes a mesma data sobrescreve a anterior; datas passadas definem o período vigente.</p>
        <form className="row wrap" style={{ gap: 10, alignItems: "flex-end" }} onSubmit={submit}>
          <label className="field" style={{ width: 150 }}>Tipo
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "TERM" | "BREAK" })}>
              <option value="TERM">Período letivo</option>
              <option value="BREAK">Férias</option>
            </select>
          </label>
          {form.type === "TERM" && (
            <label className="field" style={{ width: 130 }}>Rótulo
              <input placeholder="2026.2" value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })} required />
            </label>
          )}
          <label className="field" style={{ width: 180 }}>Começa em
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </label>
          <Button type="submit" variant="prim" disabled={add.isPending}>
            {add.isPending ? "Agendando…" : "Agendar"}
          </Button>
        </form>
        {err && <div className="err mt" role="alert">{err}</div>}
      </Card>

      <Card tight>
        <h3 style={{ padding: "6px 8px 0" }}>Linha do tempo</h3>
        {periods.isLoading ? <div className="spinner" role="status">Carregando…</div> :
          !entries.length ? (
            <p className="mut" style={{ padding: "0 8px 10px" }}>
              Nenhuma virada agendada — o sistema usa a sugestão automática por meses até você cadastrar o calendário.
            </p>
          ) : (
            <ol className="timeline">
              {entries.map((e) => {
                const isPast = new Date(e.startsAt).getTime() <= now;
                const isCurrent = e.id === currentId;
                return (
                  <li key={e.id} className={"tl-item" + (isCurrent ? " current" : isPast ? " past" : "")}>
                    <span className="tl-dot" aria-hidden="true" />
                    <span className="tl-date">{fmt.format(new Date(e.startsAt))}</span>
                    <span className={`chip ${e.type === "BREAK" ? "sim" : "avail"}`}>
                      <span className="swatch" />{e.type === "BREAK" ? "🌴 Férias" : e.term}
                    </span>
                    {isCurrent && <span className="badge">vigente</span>}
                    {!isPast && <span className="mut" style={{ fontSize: ".78rem" }}>agendado</span>}
                    <button className="tl-del" aria-label={`Remover virada de ${fmt.format(new Date(e.startsAt))}`}
                      onClick={() => { if (confirm("Remover esta virada do calendário?")) remove.mutate(e.id); }}>×</button>
                  </li>
                );
              })}
            </ol>
          )}
      </Card>
    </div>
  );
}
