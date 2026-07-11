// Admin · Cursos (RF-13): catálogo de matrizes da instância + importação de novas.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { courses } from "../../api/endpoints";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

export default function AdminCoursesPage() {
  const qc = useQueryClient();
  const [matriz, setMatriz] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");

  const list = useQuery({ queryKey: ["courses"], queryFn: courses.list });

  const doImport = useMutation({
    mutationFn: () => courses.import(JSON.parse(matriz)),
    onSuccess: (res) => {
      setImportMsg(`Curso "${res.slug}" importado (${res.subjects} disciplinas).`);
      setImportErr(""); setMatriz("");
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: () => { setImportErr("JSON inválido ou erro na importação."); setImportMsg(""); },
  });

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">Administração · catálogo</span>
        <h1>Cursos</h1>
      </header>

      <Card tight>
        <h3 style={{ padding: "6px 8px 0" }}>Matrizes cadastradas</h3>
        {list.isLoading ? <div className="spinner" role="status">Carregando…</div> :
          !list.data?.length ? <p className="mut" style={{ padding: "0 8px 8px" }}>Nenhum curso ainda — importe a primeira matriz abaixo.</p> : (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Curso</th><th>Slug</th><th style={{ textAlign: "right" }}>CH total</th></tr></thead>
                <tbody>
                  {list.data.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td><span className="badge">{c.slug}</span></td>
                      <td style={{ textAlign: "right" }}>{c.totalHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      <Card>
        <h3>Importar matriz (RF-13)</h3>
        <p className="mut">Cole o JSON no formato de <code>matrizes/</code> (<code>course</code>, <code>totalHours</code>,{" "}
          <code>requirements</code>, <code>milestones</code>, <code>subjects</code>). Reimportar um slug existente
          atualiza a matriz preservando o progresso dos alunos.</p>
        <textarea value={matriz} onChange={(e) => setMatriz(e.target.value)} rows={10}
          style={{ width: "100%", fontFamily: "monospace" }}
          placeholder='{ "course": { "slug": "...", "name": "..." }, ... }' />
        <div className="row mt" style={{ gap: 8 }}>
          <Button variant="prim" disabled={!matriz.trim() || doImport.isPending} onClick={() => doImport.mutate()}>
            {doImport.isPending ? "Importando…" : "Importar"}
          </Button>
        </div>
        {importMsg && <div className="ok mt">{importMsg}</div>}
        {importErr && <div className="err mt" role="alert">{importErr}</div>}
      </Card>
    </div>
  );
}
