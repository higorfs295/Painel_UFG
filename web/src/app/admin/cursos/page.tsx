"use client";

// Admin · Cursos (RF-13): catálogo de matrizes, importação e a LIXEIRA (RF-28) —
// exclusão em duas etapas com uma semana de arrependimento.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { courses } from "@/lib/api/endpoints";
import type { CourseImpact, TrashedCourse } from "@/lib/api/endpoints";
import { Badge, Card, Chip, EmptyState, PageHead, Section, inputCls } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DangerDialog } from "@/components/ui/danger-dialog";
import Button from "@/components/ui/button";
import { IconRestore, IconTrash } from "@/components/ui/icons";
import { cn, fmtDate, num } from "@/lib/utils";
import type { CourseSummary } from "@/lib/api/types";

type Target = { slug: string; name: string; id?: string; mode: "trash" | "purge" };

export default function AdminCursosPage() {
  const qc = useQueryClient();
  const [matriz, setMatriz] = useState("");
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
      toast.success(`Curso "${res.slug}" importado (${res.subjects} disciplinas).`);
      setMatriz("");
      refresh();
    },
    onError: () => toast.error("JSON inválido ou erro na importação."),
  });

  const doTrash = useMutation({
    mutationFn: (confirm: string) => courses.trash(target!.slug, confirm),
    onSuccess: () => { setTarget(null); setDialogErr(""); refresh(); toast.success("Curso movido para a lixeira."); },
    onError: () => setDialogErr("Não foi possível mover para a lixeira. Confira a confirmação."),
  });
  const doRestore = useMutation({
    mutationFn: (id: string) => courses.restore(id),
    onSuccess: () => { refresh(); toast.success("Curso restaurado."); },
  });
  const doPurge = useMutation({
    mutationFn: (confirm: string) => courses.purge(target!.id!, confirm),
    onSuccess: () => { setTarget(null); setDialogErr(""); refresh(); toast.success("Curso apagado definitivamente."); },
    onError: () => setDialogErr("Não foi possível apagar. Confira a confirmação."),
  });

  const retention = trash.data?.retentionDays ?? 7;
  const trashed = trash.data?.items ?? [];

  const activeCols: Column<CourseSummary>[] = [
    { header: "Curso", cell: (c) => c.name },
    { header: "Slug", cell: (c) => <Badge>{c.slug}</Badge> },
    { header: "CH total", align: "right", cell: (c) => `${num(c.totalHours)}h` },
    {
      header: "", align: "right",
      cell: (c) => (
        <Button size="sm" variant="danger" title={`Mover "${c.name}" para a lixeira`}
          onClick={() => { setDialogErr(""); setTarget({ slug: c.slug, name: c.name, mode: "trash" }); }}>
          <IconTrash /> Excluir
        </Button>
      ),
    },
  ];

  const trashCols: Column<TrashedCourse>[] = [
    { header: "Curso", cell: (c) => <span>{c.name} <Badge className="ml-1">{c.slug}</Badge></span> },
    { header: "Excluído em", cell: (c) => <span className="text-muted-foreground">{fmtDate.format(new Date(c.deletedAt))}</span> },
    {
      header: "Prazo",
      cell: (c) => (
        <Chip tone={c.daysLeft <= 1 ? "lock" : "avail"}>
          {c.expired ? "expirado" : c.daysLeft === 1 ? "último dia" : `${c.daysLeft} dias`}
        </Chip>
      ),
    },
    {
      header: "", align: "right",
      cell: (c) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => doRestore.mutate(c.id)} disabled={doRestore.isPending}>
            <IconRestore /> Restaurar
          </Button>
          <Button size="sm" variant="danger"
            onClick={() => { setDialogErr(""); setTarget({ slug: c.slug, name: c.name, id: c.id, mode: "purge" }); }}>
            Apagar de vez
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="administração · catálogo" title="Cursos" />

      <Card>
        <h3 className="section-label">Matrizes cadastradas</h3>
        {list.isLoading ? <div className="skeleton h-32" /> : (
          <DataTable rows={list.data ?? []} columns={activeCols} keyOf={(c) => c.id}
            empty={<EmptyState>Nenhum curso ativo — importe uma matriz abaixo.</EmptyState>} />
        )}
      </Card>

      <Section title="Lixeira" hint={`expurgo automático após ${retention} dias`}>
        {trashed.length === 0 ? (
          <EmptyState>
            Vazia. Cursos excluídos ficam aqui por {retention} dias antes de sumirem de vez — até lá, os
            dados dos alunos continuam intactos.
          </EmptyState>
        ) : (
          <DataTable rows={trashed} columns={trashCols} keyOf={(c) => c.id} />
        )}
      </Section>

      <Section title="Importar matriz (RF-13)">
        <p className="text-muted-foreground mb-3 text-sm">
          Cole o JSON no formato de <code>matrizes/</code> (<code>course</code>, <code>totalHours</code>,{" "}
          <code>requirements</code>, <code>milestones</code>, <code>subjects</code>). Reimportar um slug
          existente atualiza a matriz preservando o progresso dos alunos.
        </p>
        <textarea value={matriz} onChange={(e) => setMatriz(e.target.value)} rows={10}
          placeholder='{ "course": { "slug": "...", "name": "..." }, ... }'
          className={cn(inputCls, "w-full font-mono text-xs")} />
        <div className="mt-3">
          <Button variant="primary" disabled={!matriz.trim() || doImport.isPending} onClick={() => doImport.mutate()}>
            {doImport.isPending ? "Importando…" : "Importar"}
          </Button>
        </div>
      </Section>

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
            Esta ação é <b className="text-foreground">irreversível</b>. O curso, sua matriz e todo o
            progresso dos alunos matriculados nele serão removidos agora — não há como restaurar depois.
          </p>
        ) : (
          <>
            <p>
              O curso sai do catálogo e deixa de aceitar matrículas, mas nada é apagado por{" "}
              <b className="text-foreground">{retention} dias</b>: dá para restaurar a qualquer momento nesse prazo.
            </p>
            {impact.data && (
              <ul className="bg-background mt-3 flex flex-col gap-1 rounded-lg border p-3">
                <li><b className="font-display text-foreground text-base">{impact.data.enrollments}</b> matrícula(s)</li>
                <li><b className="font-display text-foreground text-base">{impact.data.subjects}</b> disciplina(s) na matriz</li>
                <li><b className="font-display text-foreground text-base">{impact.data.statuses}</b> registro(s) de progresso de alunos</li>
              </ul>
            )}
          </>
        )}
      </DangerDialog>
    </div>
  );
}
