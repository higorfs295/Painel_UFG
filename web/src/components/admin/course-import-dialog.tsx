"use client";

// Importar matriz (RF-13, v12): arquivo ou JSON colado → PRÉVIA (o servidor valida e compara
// com o que existe, sem gravar) → importar. A prévia mostra o que entra, o que muda, o que o
// arquivo deixou de fora e requisitos que apontam para lugar nenhum.
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { RiAlertLine, RiCheckboxCircleLine, RiCloseCircleLine, RiUploadCloud2Line } from "@remixicon/react";
import { courses } from "@/lib/api/endpoints";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/tremor/Dialog";
import { Button } from "@/components/tremor/Button";
import { Label } from "@/components/tremor/Label";
import { Textarea } from "@/components/tremor/Textarea";
import { CountUp } from "@/components/fx/count-up";
import { Pill } from "./panel";
import { cx } from "@/lib/utils";
import type { ImportPreview } from "@/lib/api/types";

export function CourseImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [parseErr, setParseErr] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const json = () => { try { setParseErr(""); return JSON.parse(text); } catch (e) { setParseErr(e instanceof Error ? e.message : "JSON inválido"); return null; } };
  const check = useMutation({ mutationFn: (m: unknown) => courses.previewImport(m), onSuccess: setPreview, onError: () => toast.error("Não foi possível validar.") });
  const run = useMutation({
    mutationFn: (m: unknown) => courses.import(m),
    onSuccess: (res) => {
      toast.success(`Matriz "${res.slug}" importada (${res.subjects} disciplinas).`);
      qc.invalidateQueries({ queryKey: ["courses"] }); qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      onOpenChange(false); setText(""); setPreview(null);
    },
    onError: () => toast.error("A importação falhou."),
  });

  const load = (f: File) => f.text().then((t) => { setText(t); setPreview(null); });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPreview(null); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar matriz</DialogTitle>
          <DialogDescription>
            JSON no formato de <code>matrizes/</code>. Reimportar um slug que já existe atualiza a matriz e preserva o progresso dos alunos.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex max-h-[65vh] flex-col gap-4 overflow-y-auto">
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void load(f); }}
            className={cx("grid place-items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition",
              drag ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-300 dark:border-gray-700")}>
            <RiUploadCloud2Line className="size-8 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <p className="text-sm text-gray-700 dark:text-gray-300">Arraste o arquivo <b>.json</b> aqui ou</p>
            <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" id="matriz-arquivo"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ""; }} />
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>Escolher arquivo</Button>
          </div>
          <div>
            <Label htmlFor="matriz-json">…ou cole o JSON</Label>
            <Textarea id="matriz-json" rows={6} className="mt-2 font-mono text-xs" value={text}
              onChange={(e) => { setText(e.target.value); setPreview(null); }} placeholder='{ "course": { "slug": "...", "name": "..." }, ... }' />
            {parseErr && <p role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-400">JSON inválido: {parseErr}</p>}
          </div>

          {preview && !preview.valid && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-500/30 dark:bg-red-500/10">
              <p className="flex items-center gap-2 font-medium text-red-800 dark:text-red-300"><RiCloseCircleLine className="size-4" aria-hidden="true" />A matriz não passou na validação</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-red-800 dark:text-red-300">
                {preview.errors.map((e, i) => <li key={i}><code>{e.path || "(raiz)"}</code>: {e.message}</li>)}
              </ul>
            </div>
          )}
          {preview?.valid && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <RiCheckboxCircleLine className="size-5 text-emerald-600" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{preview.name}</p>
                <Pill tone={preview.exists ? "blue" : "emerald"}>{preview.exists ? "atualiza curso existente" : "curso novo"}</Pill>
              </div>
              <div className="stagger grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([["disciplinas", preview.counts.subjects], ["composições", preview.counts.requirements], ["marcos", preview.counts.milestones], ["requisitos", preview.counts.requisites]] as const).map(([k, v]) => (
                  <div key={k} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
                    <CountUp value={v} className="text-lg font-semibold text-gray-900 dark:text-gray-50" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{k}</p>
                  </div>
                ))}
              </div>
              {preview.exists && (
                <div className="flex flex-wrap gap-2">
                  <Pill tone="emerald">{preview.added.length} nova(s)</Pill>
                  <Pill tone="blue">{preview.changed.length} alterada(s)</Pill>
                  <Pill tone={preview.missing.length ? "amber" : "gray"}>{preview.missing.length} fora do arquivo</Pill>
                </div>
              )}
              {(preview.warnings.length > 0 || preview.orphans.length > 0) && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="flex items-center gap-2 font-medium"><RiAlertLine className="size-4" aria-hidden="true" />Vale conferir antes de importar</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                    {preview.warnings.map((w) => <li key={w}>{w}</li>)}
                    {preview.orphans.length > 0 && <li>{preview.orphans.length} requisito(s) apontam para disciplina/marco inexistente e serão ignorados (ex.: seq {preview.orphans[0]!.seq} → {String(preview.orphans[0]!.ref)})</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
          {preview?.valid ? (
            <Button type="button" isLoading={run.isPending} loadingText="Importando…" onClick={() => { const m = json(); if (m) run.mutate(m); }}>
              Importar agora
            </Button>
          ) : (
            <Button type="button" disabled={!text.trim()} isLoading={check.isPending} loadingText="Validando…"
              onClick={() => { const m = json(); if (m) check.mutate(m); }}>
              Pré-visualizar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
