// Admin · Cursos (RF-13): catálogo de matrizes da instância, importação de novas e a
// LIXEIRA (RF-28) — exclusão em duas etapas com uma semana de arrependimento.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { courses } from "../../api/endpoints";
import type { CourseImpact } from "../../api/endpoints";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import DangerDialog from "../../components/ui/DangerDialog";
import { IconTrash, IconRestore } from "../../components/ui/Icons";

type Target = { slug: string; name: string; id?: string; mode: "trash" | "purge" };

export default function AdminCoursesPage() {
  const qc = useQueryClient();
  const [matriz, setMatriz] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [dialogErr, setDialogErr] = useState("");

  const list = useQuery({ queryKey: ["courses"], queryFn: courses.list });
  const trash = useQuery({ queryKey: ["courses-trash"], queryFn: courses.trashList });

  // impacto do curso em foco — carregado só quando o diálogo abre
  const impact = useQuery<CourseImpact>({
    queryKey: ["course-impact", target?.slug],
    queryFn: () => courses.impact(target!.slug),
    enabled: !!target && target.mode === "trash",
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["courses-trash"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const doImport = useMutation({
    mutationFn: () => courses.import(JSON.parse(matriz)),
    onSuccess: (res) => {
      setImportMsg(`Curso "${res.slug}" importado (${res.subjects} disciplinas).`);
      setImportErr(""); setMatriz(""); refresh();
    },
    onError: () => { setImportErr("JSON inválido ou erro na importação."); setImportMsg(""); },
  });

  const doTrash = useMutation({
    mutationFn: (confirm: string) => courses.trash(target!.slug, confirm),
    onSuccess: () => { setTarget(null); setDialogErr(""); refresh(); },
    onError: () => setDialogErr("Não foi possível mover para a lixeira. Confira a confirmação."),
  });
  const doRestore = useMutation({ mutationFn: (id: string) => courses.restore(id), onSuccess: refresh });
  const doPurge = useMutation({
    mutationFn: (confirm: string) => courses.purge(target!.id!, confirm),
    onSuccess: () => { setTarget(null); setDialogErr(""); refresh(); },
    onError: () => setDialogErr("Não foi possível apagar. Confira a confirmação."),
  });

  const retention = trash.data?.retentionDays ?? 7;
  const trashed = trash.data?.items ?? [];

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">Administração · catálogo</span>
        <h1>Cursos</h1>
      </header>

      <Card tight>
        <h3 style={{ padding: "6px 8px 0" }}>Matrizes cadastradas</h3>
        {list.isLoading ? <div className="spinner" role="status">Carregando…</div> :
          !list.data?.length ? <p className="mut" style={{ padding: "0 8px 8px" }}>Nenhum curso ativo — importe uma matriz abaixo.</p> : (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Curso</th><th>Slug</th><th style={{ textAlign: "right" }}>CH total</th><th /></tr></thead>
                <tbody>
                  {list.data.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td><span className="badge">{c.slug}</span></td>
                      <td style={{ textAlign: "right" }}>{c.totalHours}h</td>
                      <td style={{ textAlign: "right" }}>
                        <Button size="sm" variant="warn" title={`Mover "${c.name}" para a lixeira`}
                          onClick={() => { setDialogErr(""); setTarget({ slug: c.slug, name: c.name, mode: "trash" }); }}>
                          <IconTrash /> Excluir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      {/* ── Lixeira (RF-28) ── */}
      <Card tight>
        <div className="row wrap spread" style={{ padding: "6px 8px 0" }}>
          <h3 style={{ margin: 0 }}>Lixeira</h3>
          <span className="mut" style={{ fontSize: ".8rem" }}>
            expurgo automático após {retention} dias
          </span>
        </div>
        {trashed.length === 0 ? (
          <p className="mut" style={{ padding: "8px 8px 8px" }}>
            Vazia. Cursos excluídos ficam aqui por {retention} dias antes de sumirem de vez —
            até lá, os dados dos alunos continuam intactos.
          </p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Curso</th><th>Excluído em</th><th>Prazo</th><th /></tr></thead>
              <tbody>
                {trashed.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name} <span className="badge">{c.slug}</span></td>
                    <td className="mut">{new Date(c.deletedAt).toLocaleDateString("pt-BR")}</td>
                    <td>
                      <span className={"chip " + (c.daysLeft <= 1 ? "lock" : "avail")}>
                        <span className="swatch" />
                        {c.expired ? "expirado" : c.daysLeft === 1 ? "último dia" : `${c.daysLeft} dias`}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <Button size="sm" onClick={() => doRestore.mutate(c.id)} disabled={doRestore.isPending}>
                          <IconRestore /> Restaurar
                        </Button>
                        <Button size="sm" variant="warn"
                          onClick={() => { setDialogErr(""); setTarget({ slug: c.slug, name: c.name, id: c.id, mode: "purge" }); }}>
                          Apagar de vez
                        </Button>
                      </div>
                    </td>
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

      <DangerDialog
        open={!!target}
        title={target?.mode === "purge" ? `Apagar "${target?.name}" definitivamente` : `Excluir "${target?.name}"`}
        keyword={target?.slug ?? ""}
        confirmLabel={target?.mode === "purge" ? "Apagar definitivamente" : "Mover para a lixeira"}
        pending={doTrash.isPending || doPurge.isPending}
        error={dialogErr}
        onClose={() => { setTarget(null); setDialogErr(""); }}
        onConfirm={(typed) => (target?.mode === "purge" ? doPurge.mutate(typed) : doTrash.mutate(typed))}
      >
        {target?.mode === "purge" ? (
          <p>
            Esta ação é <b>irreversível</b>. O curso, sua matriz e todo o progresso dos alunos
            matriculados nele serão removidos agora — não há como restaurar depois.
          </p>
        ) : (
          <>
            <p>
              O curso sai do catálogo e deixa de aceitar matrículas, mas nada é apagado por{" "}
              <b>{retention} dias</b>: dá para restaurar a qualquer momento nesse prazo.
            </p>
            {impact.data && (
              <ul className="impact">
                <li><b>{impact.data.enrollments}</b> matrícula(s)</li>
                <li><b>{impact.data.subjects}</b> disciplina(s) na matriz</li>
                <li><b>{impact.data.statuses}</b> registro(s) de progresso de alunos</li>
              </ul>
            )}
          </>
        )}
      </DangerDialog>
    </div>
  );
}
