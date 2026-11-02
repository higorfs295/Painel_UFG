"use client";

// Admin · Cursos (RF-13/28, v12): um cartão por matriz (disciplinas, carga, alunos), importação
// com prévia, exportação do JSON, edição do cabeçalho e a LIXEIRA — exclusão em duas etapas
// com uma semana de arrependimento.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  RiBarChartBoxLine, RiBookOpenLine, RiDeleteBinLine, RiDownloadLine, RiEditLine, RiEyeLine, RiGraduationCapLine,
  RiRestartLine, RiTimeLine, RiUploadCloud2Line, RiGroupLine, RiDeleteBin2Line,
} from "@remixicon/react";
import { admin, courses } from "@/lib/api/endpoints";
import type { CourseImpact } from "@/lib/api/endpoints";
import { PageBanner } from "@/components/fx/page-banner";
import { EmptyArt } from "@/components/fx/art";
import { CountUp } from "@/components/fx/count-up";
import { Panel, Pill } from "@/components/admin/panel";
import { CourseImportDialog } from "@/components/admin/course-import-dialog";
import { courseInitials, shortCourse } from "@/components/layout/course-switcher";
import { DangerDialog } from "@/components/ui/danger-dialog";
import { Button } from "@/components/tremor/Button";
import { Input } from "@/components/tremor/Input";
import { Label } from "@/components/tremor/Label";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/tremor/Dialog";
import { hashTone, tone } from "@/lib/palette";
import { cx, fmtDate, num } from "@/lib/utils";
import { downloadJSON } from "@/lib/csv";

type Target = { slug: string; name: string; id?: string; mode: "trash" | "purge" };

export default function AdminCursosPage() {
  return <Suspense fallback={<div className="skeleton h-96" />}><CoursesInner /></Suspense>;
}

function CoursesInner() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [dialogErr, setDialogErr] = useState("");
  const [edit, setEdit] = useState<{ slug: string; name: string; totalHours: string } | null>(null);
  useEffect(() => { if (params.get("importar")) setImportOpen(true); }, [params]);

  const analytics = useQuery({ queryKey: ["admin-analytics"], queryFn: admin.analytics });
  const trash = useQuery({ queryKey: ["courses-trash"], queryFn: courses.trashList });
  const impact = useQuery<CourseImpact>({
    queryKey: ["course-impact", target?.slug], queryFn: () => courses.impact(target!.slug), enabled: !!target && target.mode === "trash",
  });
  const refresh = () => {
    for (const k of [["courses"], ["courses-trash"], ["admin-analytics"], ["admin-stats"]]) qc.invalidateQueries({ queryKey: k });
  };

  const doTrash = useMutation({
    mutationFn: (confirm: string) => courses.trash(target!.slug, confirm),
    onSuccess: () => { setTarget(null); setDialogErr(""); refresh(); toast.success("Curso movido para a lixeira."); },
    onError: () => setDialogErr("Não foi possível mover para a lixeira. Confira a confirmação."),
  });
  const doRestore = useMutation({ mutationFn: (id: string) => courses.restore(id), onSuccess: () => { refresh(); toast.success("Curso restaurado."); } });
  const doPurge = useMutation({
    mutationFn: (confirm: string) => courses.purge(target!.id!, confirm),
    onSuccess: () => { setTarget(null); setDialogErr(""); refresh(); toast.success("Curso apagado definitivamente."); },
    onError: () => setDialogErr("Não foi possível apagar. Confira a confirmação."),
  });
  const saveEdit = useMutation({
    mutationFn: () => courses.patch(edit!.slug, { name: edit!.name.trim(), totalHours: Number(edit!.totalHours) }),
    onSuccess: () => { setEdit(null); refresh(); toast.success("Curso atualizado."); },
    onError: () => toast.error("Verifique o nome (3+ letras) e a carga horária."),
  });
  const exportOne = async (slug: string) => {
    try { downloadJSON(`matriz-${slug}.json`, await courses.exportMatrix(slug)); toast.success("Matriz baixada."); }
    catch { toast.error("Não foi possível exportar."); }
  };

  const list = analytics.data?.courses ?? [];
  const retention = trash.data?.retentionDays ?? 7;
  const trashed = trash.data?.items ?? [];
  const totals = list.reduce((a, c) => ({ subjects: a.subjects + c.subjects, students: a.students + c.enrollments }), { subjects: 0, students: 0 });

  return (
    <div className="flex flex-col gap-6">
      <PageBanner eyebrow="Catálogo" icon={RiBookOpenLine} title="Cursos e matrizes"
        description="Cada curso é uma matriz importada por JSON. Baixe o arquivo, ajuste e reimporte para manter a matriz em dia — a prévia mostra o que muda antes de gravar."
        actions={<>
          <Button onClick={() => setImportOpen(true)}><RiUploadCloud2Line className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Importar matriz</Button>
          <Button asChild variant="secondary"><Link href="/admin/relatorios"><RiBarChartBoxLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Relatórios</Link></Button>
        </>}
        aside={
          <div className="flex gap-6 text-sm">
            {([["cursos", list.length], ["disciplinas", totals.subjects], ["alunos", totals.students]] as const).map(([k, v]) => (
              <div key={k}><CountUp value={v} className="block text-2xl font-semibold text-gray-900 dark:text-gray-50" /><span className="text-xs text-gray-500 dark:text-gray-400">{k}</span></div>
            ))}
          </div>
        }
      />

      {analytics.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-52" />)}</div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <EmptyArt icon={RiGraduationCapLine} />
          <p className="mt-4 font-medium text-gray-900 dark:text-gray-50">Nenhum curso ainda</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Importe a primeira matriz para os alunos poderem se matricular.</p>
          <Button className="mt-4" onClick={() => setImportOpen(true)}>Importar matriz</Button>
        </div>
      ) : (
        <div className="stagger grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const t = tone(hashTone(c.slug));
            return (
              <article key={c.slug} className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-950">
                <div aria-hidden="true" className={cx("relative h-16 overflow-hidden", t.dot)}>
                  <div className="dot-grid absolute inset-0 text-white/25" />
                  <div className="hatch absolute -right-4 -bottom-6 h-20 w-28 rotate-6 text-white/20" />
                </div>
                <div className="relative -mt-7 flex flex-1 flex-col px-5 pb-5">
                  <span className={cx("grid size-12 place-items-center rounded-lg border-4 border-white text-sm font-bold shadow-sm dark:border-gray-950", t.solid)}>
                    {courseInitials(c.name)}
                  </span>
                  <h2 className="mt-3 line-clamp-2 font-semibold text-gray-900 dark:text-gray-50" title={c.name}>{shortCourse(c.name)}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{c.slug}</p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {([["disciplinas", c.subjects, RiBookOpenLine], ["carga", `${num(c.totalHours)}h`, RiTimeLine], ["alunos", c.enrollments, RiGroupLine]] as const).map(([k, v, Icon]) => (
                      <div key={k} className="rounded-md bg-gray-50 px-2 py-2 dark:bg-gray-900">
                        <Icon className={cx("mx-auto size-4", t.text)} aria-hidden="true" />
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-50">{v}</dd>
                        <dt className="text-[0.65rem] text-gray-500 dark:text-gray-400">{k}</dt>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild variant="secondary" className="flex-1"><Link href={`/admin/cursos/${c.slug}`}><RiEyeLine className="mr-1.5 size-4" aria-hidden="true" />Matriz</Link></Button>
                    <Button asChild variant="secondary" className="flex-1"><Link href={`/admin/relatorios?curso=${c.slug}`}><RiBarChartBoxLine className="mr-1.5 size-4" aria-hidden="true" />Relatório</Link></Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-dashed border-gray-200 pt-2 dark:border-gray-800">
                    <Button variant="ghost" className="px-2 text-xs" onClick={() => exportOne(c.slug)}><RiDownloadLine className="mr-1 size-3.5" aria-hidden="true" />JSON</Button>
                    <Button variant="ghost" className="px-2 text-xs" onClick={() => setEdit({ slug: c.slug, name: c.name, totalHours: String(c.totalHours) })}><RiEditLine className="mr-1 size-3.5" aria-hidden="true" />Editar</Button>
                    <Button variant="ghost" className="px-2 text-xs text-red-700 dark:text-red-400" aria-label={`Excluir ${c.name}`}
                      onClick={() => { setDialogErr(""); setTarget({ slug: c.slug, name: c.name, mode: "trash" }); }}>
                      <RiDeleteBinLine className="mr-1 size-3.5" aria-hidden="true" />Excluir
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Panel icon={RiDeleteBin2Line} tone="amber" id="lixeira" title="Lixeira" description={`cursos excluídos somem de vez depois de ${retention} dias`}>
        {trashed.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Vazia. Até o expurgo, os dados dos alunos de um curso excluído continuam intactos e dá para restaurar.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-900">
            {trashed.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{c.slug} · excluído em {fmtDate.format(new Date(c.deletedAt))}</p>
                </div>
                <Pill tone={c.daysLeft <= 1 ? "red" : "amber"}>{c.expired ? "expirado" : c.daysLeft === 1 ? "último dia" : `${c.daysLeft} dias`}</Pill>
                <Button variant="secondary" onClick={() => doRestore.mutate(c.id)} disabled={doRestore.isPending}><RiRestartLine className="mr-1.5 size-4" aria-hidden="true" />Restaurar</Button>
                <Button variant="destructive" onClick={() => { setDialogErr(""); setTarget({ slug: c.slug, name: c.name, id: c.id, mode: "purge" }); }}>Apagar de vez</Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <CourseImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <Dialog open={!!edit} onOpenChange={(v) => { if (!v) setEdit(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar curso</DialogTitle>
            <DialogDescription>Disciplinas, composições e marcos mudam pela importação da matriz.</DialogDescription>
          </DialogHeader>
          {edit && (
            <form className="mt-4 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); saveEdit.mutate(); }}>
              <div><Label htmlFor="ed-nome">Nome</Label><Input id="ed-nome" className="mt-2" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div>
                <Label htmlFor="ed-ch">Carga horária total (h)</Label>
                <Input id="ed-ch" type="number" min={1} className="mt-2" value={edit.totalHours} onChange={(e) => setEdit({ ...edit, totalHours: e.target.value })} />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Entra no cálculo do progresso de todos os alunos do curso.</p>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                <Button type="submit" isLoading={saveEdit.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
          <p>Esta ação é <b className="text-foreground">irreversível</b>. O curso, sua matriz e todo o progresso dos alunos matriculados nele serão removidos agora.</p>
        ) : (
          <>
            <p>O curso sai do catálogo e deixa de aceitar matrículas, mas nada é apagado por <b className="text-foreground">{retention} dias</b>: dá para restaurar nesse prazo.</p>
            {impact.data && (
              <ul className="bg-background mt-3 flex flex-col gap-1 rounded-lg border p-3">
                <li><b className="num text-foreground text-base">{impact.data.enrollments}</b> matrícula(s)</li>
                <li><b className="num text-foreground text-base">{impact.data.subjects}</b> disciplina(s) na matriz</li>
                <li><b className="num text-foreground text-base">{impact.data.statuses}</b> registro(s) de progresso de alunos</li>
              </ul>
            )}
          </>
        )}
      </DangerDialog>
    </div>
  );
}
