// Extras: optativas fora da matriz, Núcleo Livre, Atividades Complementares e registros (RF-08/09).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { extras as extrasApi } from "../api/endpoints";
import { useApp } from "../store/app";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import type { ExtraCategory } from "../api/types";

const CATS: { v: ExtraCategory; label: string }[] = [
  { v: "OPT", label: "Optativa (NE)" }, { v: "NL", label: "Núcleo Livre" },
  { v: "AC", label: "Atividade Complementar" }, { v: "NONE", label: "Registro (não soma)" },
];

export default function ExtrasPage() {
  const enrollmentId = useApp((s) => s.enrollmentId)!;
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", code: "", hours: 0, category: "NL" as ExtraCategory, done: true });

  const { data: list, isLoading } = useQuery({
    queryKey: ["extras", enrollmentId], queryFn: () => extrasApi.list(enrollmentId), enabled: !!enrollmentId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["extras", enrollmentId] });
    qc.invalidateQueries({ queryKey: ["progress", enrollmentId] });
  };
  const create = useMutation({ mutationFn: () => extrasApi.create(enrollmentId, { ...form, code: form.code || undefined }), onSuccess: () => { invalidate(); setForm({ name: "", code: "", hours: 0, category: "NL", done: true }); } });
  const toggle = useMutation({ mutationFn: (v: { id: string; done: boolean }) => extrasApi.update(v.id, { done: v.done }), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => extrasApi.remove(id), onSuccess: invalidate });

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">além da matriz</span>
        <h1>Componentes <em>extras</em></h1>
      </header>
      <p className="mut">Optativas fora da matriz, Núcleo Livre, Atividades Complementares e registros (estágio, ligas, IC). Planejados não somam.</p>

      <Card>
        <h3>Adicionar</h3>
        <form className="row wrap" style={{ gap: 10, alignItems: "flex-end" }}
          onSubmit={(e) => { e.preventDefault(); if (form.name.trim().length >= 2) create.mutate(); }}>
          <label className="field" style={{ flex: "2 1 240px" }}>Nome
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
          </label>
          <label className="field" style={{ flex: "1 1 120px" }}>Código
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="opcional" />
          </label>
          <label className="field" style={{ width: 90 }}>CH
            <input type="number" min={0} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} />
          </label>
          <label className="field" style={{ flex: "1 1 160px" }}>Categoria
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExtraCategory })}>
              {CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 120 }}>Situação
            <select value={form.done ? "1" : "0"} onChange={(e) => setForm({ ...form, done: e.target.value === "1" })}>
              <option value="1">Concluído</option><option value="0">Planejado</option>
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
                {list.map((x) => (
                  <tr key={x.id}>
                    <td>{x.name}</td>
                    <td className="mut">{x.code || "—"}</td>
                    <td>{x.hours}h</td>
                    <td><span className="badge">{x.category}</span></td>
                    <td>{x.done ? <span className="chip done"><span className="swatch" />Concluído</span> : <span className="chip sim"><span className="swatch" />Planejado</span>}</td>
                    <td>
                      <div className="row wrap" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <Button size="sm" onClick={() => toggle.mutate({ id: x.id, done: !x.done })}>{x.done ? "Marcar planejado" : "Marcar concluído"}</Button>
                        <Button size="sm" variant="warn" onClick={() => remove.mutate(x.id)}>Remover</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
