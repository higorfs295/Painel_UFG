// Extras: optativas fora da matriz, Núcleo Livre, Atividades Complementares e registros (RF-08/09).
// Três estados (planejado/em andamento/concluído) e categoria reclassificável (um NL pode virar
// NC, NE ou NE optativa) — a conversão é só trocar a categoria, que reroteia a soma.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { extras as extrasApi } from "../api/endpoints";
import { useApp } from "../store/app";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import type { ExtraCategory, ExtraStatus } from "../api/types";

const CATS: { v: ExtraCategory; label: string }[] = [
  { v: "NC", label: "Núcleo Comum" }, { v: "NE", label: "Núcleo Específico" },
  { v: "OPT", label: "NE optativa" }, { v: "NL", label: "Núcleo Livre" },
  { v: "AC", label: "Atividade Complementar" }, { v: "NONE", label: "Registro (não soma)" },
];
const STATUS: { v: ExtraStatus; label: string; chip: string }[] = [
  { v: "PLANNED", label: "Planejado", chip: "lock" },
  { v: "IN_PROGRESS", label: "Em andamento", chip: "cursando" },
  { v: "DONE", label: "Concluído", chip: "done" },
];
const catLabel = (v: ExtraCategory) => CATS.find((c) => c.v === v)?.label ?? v;
const statusMeta = (v: ExtraStatus) => STATUS.find((s) => s.v === v) ?? STATUS[2];

export default function ExtrasPage() {
  const enrollmentId = useApp((s) => s.enrollmentId)!;
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", code: "", hours: 0, category: "NL" as ExtraCategory, status: "DONE" as ExtraStatus });

  const { data: list, isLoading } = useQuery({
    queryKey: ["extras", enrollmentId], queryFn: () => extrasApi.list(enrollmentId), enabled: !!enrollmentId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["extras", enrollmentId] });
    qc.invalidateQueries({ queryKey: ["progress", enrollmentId] });
  };
  const create = useMutation({ mutationFn: () => extrasApi.create(enrollmentId, { ...form, code: form.code || undefined }), onSuccess: () => { invalidate(); setForm({ name: "", code: "", hours: 0, category: "NL", status: "DONE" }); } });
  const patch = useMutation({ mutationFn: (v: { id: string; patch: { status?: ExtraStatus; category?: ExtraCategory } }) => extrasApi.update(v.id, v.patch), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => extrasApi.remove(id), onSuccess: invalidate });

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">além da matriz</span>
        <h1>Componentes <em>extras</em></h1>
      </header>
      <p className="mut">Optativas fora da matriz, Núcleo Livre, Atividades Complementares e registros (estágio, ligas, IC).
        <b> Concluído</b> soma no oficial; <b>Em andamento</b> soma só na projeção; <b>Planejado</b> não soma.</p>

      <Card>
        <h3>Adicionar</h3>
        <form className="row wrap" style={{ gap: 10, alignItems: "flex-end" }}
          onSubmit={(e) => { e.preventDefault(); if (form.name.trim().length >= 2) create.mutate(); }}>
          <label className="field" style={{ flex: "2 1 220px" }}>Nome
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
          </label>
          <label className="field" style={{ flex: "1 1 110px" }}>Código
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="opcional" />
          </label>
          <label className="field" style={{ width: 84 }}>CH
            <input type="number" min={0} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} />
          </label>
          <label className="field" style={{ flex: "1 1 170px" }}>Categoria
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExtraCategory })}>
              {CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 150 }}>Situação
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ExtraStatus })}>
              {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </label>
          <Button type="submit" variant="prim" disabled={create.isPending}>Adicionar</Button>
        </form>
        {form.category === "OPT" && <p className="mut mt" style={{ fontSize: ".82rem" }}>⚠️ A equivalência de optativas externas depende de validação da coordenação.</p>}
      </Card>

      <Card tight>
        {isLoading ? <div className="spinner">Carregando…</div> : !list || list.length === 0 ? (
          <div className="muted-box">Nenhum componente extra cadastrado.</div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Nome</th><th>Código</th><th>CH</th><th>Categoria</th><th>Situação</th><th style={{ textAlign: "right" }}>Ações</th></tr></thead>
              <tbody>
                {list.map((x) => {
                  const meta = statusMeta(x.status);
                  return (
                    <tr key={x.id}>
                      <td>{x.name}</td>
                      <td className="mut">{x.code || "—"}</td>
                      <td>{x.hours}h</td>
                      <td>
                        {/* converter: trocar a categoria reroteia a soma (ex.: NL -> NC/NE/optativa) */}
                        <select value={x.category} aria-label={`Categoria de ${x.name}`} title={catLabel(x.category)}
                          onChange={(e) => patch.mutate({ id: x.id, patch: { category: e.target.value as ExtraCategory } })}>
                          {CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <span className={`chip ${meta.chip}`} style={{ minWidth: 118 }}><span className="swatch" />{meta.label}</span>
                          <select value={x.status} aria-label={`Situação de ${x.name}`}
                            onChange={(e) => patch.mutate({ id: x.id, patch: { status: e.target.value as ExtraStatus } })}>
                            {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                          </select>
                        </div>
                      </td>
                      <td>
                        <div className="row wrap" style={{ gap: 6, justifyContent: "flex-end" }}>
                          <Button size="sm" variant="warn" onClick={() => remove.mutate(x.id)}>Remover</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
