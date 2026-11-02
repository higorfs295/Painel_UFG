"use client";

// Diálogos da tela de Usuários (v12): convite individual e importação em lote por CSV.
// Os dois devolvem o LINK do convite na tela — sem SMTP configurado, é assim que ele chega
// à pessoa (RF-18).
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { RiCheckLine, RiFileCopyLine, RiUploadCloud2Line } from "@remixicon/react";
import { admin, courses } from "@/lib/api/endpoints";
import { parseCSV, rowsToUsers } from "@/lib/csv-parse";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/tremor/Dialog";
import { Button } from "@/components/tremor/Button";
import { Input } from "@/components/tremor/Input";
import { Label } from "@/components/tremor/Label";
import { Textarea } from "@/components/tremor/Textarea";
import { selectCls } from "@/components/ui";
import { Pill } from "./panel";
import type { UserImportResult } from "@/lib/api/types";

export function CopyLink({ link, emailed }: { link: string; emailed: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <p className="font-medium text-emerald-800 dark:text-emerald-300">
        {emailed ? "Convite enviado por e-mail. Link de reserva:" : "SMTP não configurado — repasse este link:"}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-sm bg-white px-2 py-1 text-xs dark:bg-gray-950">{link}</code>
        <Button type="button" variant="secondary" className="shrink-0 px-2 py-1"
          onClick={() => navigator.clipboard.writeText(link).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })}>
          {ok ? <RiCheckLine className="size-4" aria-hidden="true" /> : <RiFileCopyLine className="size-4" aria-hidden="true" />}
          <span className="sr-only">Copiar link</span>
        </Button>
      </div>
    </div>
  );
}

const EMPTY = { name: "", email: "", role: "USER" as "USER" | "ADMIN", courseSlug: "" };

export function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState<{ link: string; emailed: boolean; name: string } | null>(null);
  const courseList = useQuery({ queryKey: ["courses"], queryFn: courses.list, enabled: open });
  const create = useMutation({
    mutationFn: () => admin.createUser({ ...form, courseSlug: form.courseSlug || undefined }),
    onSuccess: (res) => {
      setResult({ ...res.invite, name: res.user.name });
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      toast.success(res.invite.emailed ? "Convite enviado por e-mail." : "Conta criada — repasse o link.");
    },
    onError: (e) => toast.error(e instanceof Error && /409|cadastrado/.test(e.message) ? "Esse e-mail já tem conta." : "Não foi possível criar a conta."),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setResult(null); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>A conta nasce sem senha; a pessoa define a própria pelo link do convite.</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">Conta de <b>{result.name}</b> criada.</p>
            <CopyLink link={result.link} emailed={result.emailed} />
            <DialogFooter className="mt-2">
              <Button type="button" variant="secondary" onClick={() => setResult(null)}>Convidar outra pessoa</Button>
              <DialogClose asChild><Button type="button">Concluir</Button></DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <form className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => { e.preventDefault(); if (form.name && form.email) create.mutate(); }}>
            <div className="sm:col-span-2">
              <Label htmlFor="conv-nome">Nome</Label>
              <Input id="conv-nome" className="mt-2" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="conv-email">E-mail</Label>
              <Input id="conv-email" type="email" className="mt-2" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="conv-papel">Papel</Label>
              <select id="conv-papel" className={`${selectCls} mt-2`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "USER" | "ADMIN" })}>
                <option value="USER">Aluno</option><option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div>
              <Label htmlFor="conv-curso">Curso inicial (opcional)</Label>
              <select id="conv-curso" className={`${selectCls} mt-2`} value={form.courseSlug} onChange={(e) => setForm({ ...form, courseSlug: e.target.value })}>
                <option value="">— nenhum —</option>
                {courseList.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <DialogFooter className="mt-2 sm:col-span-2">
              <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
              <Button type="submit" isLoading={create.isPending} loadingText="Criando…">Criar e convidar</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

const SAMPLE = "nome;email;curso\nMaria Souza;maria@discente.ufg.br;engcomp-2021\nJoão Lima;joao@discente.ufg.br;";

export function ImportUsersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [result, setResult] = useState<UserImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => rowsToUsers(parseCSV(text)), [text]);
  const valid = rows.filter((r) => !r.error);

  const run = useMutation({
    mutationFn: () => admin.importUsers(valid.map(({ name, email, courseSlug, role }) => ({ name, email, role, ...(courseSlug ? { courseSlug } : {}) }))),
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      toast.success(`${res.created} de ${res.total} conta(s) criada(s).`);
    },
    onError: () => toast.error("A importação falhou — nada foi alterado além do que já constar no resultado."),
  });

  const links = result?.results.filter((r) => r.invite).map((r) => `${r.email};${r.invite!.link}`).join("\n") ?? "";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setResult(null); setText(""); } }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar usuários (CSV)</DialogTitle>
          <DialogDescription>
            Uma pessoa por linha: <code>nome;email;curso;papel</code> (curso e papel são opcionais; aceita vírgula ou ponto e vírgula e cabeçalho).
            Cada conta recebe um convite. Máximo de 200 linhas por vez.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="mt-4 flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              <Pill tone="emerald">{result.created} criada(s)</Pill>
              <Pill tone="amber">{result.results.filter((r) => r.status === "exists").length} já existiam</Pill>
              <Pill tone="red">{result.results.filter((r) => r.status === "error").length} com erro</Pill>
            </div>
            <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm dark:divide-gray-900 dark:border-gray-800">
              {result.results.map((r) => (
                <li key={r.row} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-8 text-xs tabular-nums text-gray-500">#{r.row}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-900 dark:text-gray-50">{r.email || "—"}</span>
                  <Pill tone={r.status === "created" ? "emerald" : r.status === "exists" ? "amber" : "red"}>
                    {r.status === "created" ? (r.invite?.emailed ? "convite enviado" : "criada") : r.status === "exists" ? "já existia" : r.error ?? "erro"}
                  </Pill>
                </li>
              ))}
            </ul>
            {links && (
              <Button type="button" variant="secondary" className="w-fit"
                onClick={() => navigator.clipboard.writeText(links).then(() => toast.success("Links copiados (e-mail;link por linha)."))}>
                <RiFileCopyLine className="mr-1.5 size-4" aria-hidden="true" /> Copiar todos os links de convite
              </Button>
            )}
            <DialogFooter><DialogClose asChild><Button type="button">Concluir</Button></DialogClose></DialogFooter>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="sr-only" id="csv-arquivo"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(setText); e.target.value = ""; }} />
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                <RiUploadCloud2Line className="mr-1.5 size-4" aria-hidden="true" /> Escolher arquivo
              </Button>
              <Button type="button" variant="light" onClick={() => setText(SAMPLE)}>Ver exemplo</Button>
            </div>
            <Label htmlFor="csv-texto" className="sr-only">Conteúdo do CSV</Label>
            <Textarea id="csv-texto" rows={6} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={"nome;email;curso\nMaria Souza;maria@discente.ufg.br;engcomp-2021"} className="font-mono text-xs" />
            {rows.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    <tr><th className="px-3 py-1.5 font-medium">Linha</th><th className="px-3 py-1.5 font-medium">Nome</th><th className="px-3 py-1.5 font-medium">E-mail</th><th className="px-3 py-1.5 font-medium">Curso</th><th className="px-3 py-1.5 font-medium" /></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                    {rows.map((r) => (
                      <tr key={r.line}>
                        <td className="px-3 py-1.5 text-xs tabular-nums text-gray-500">{r.line}</td>
                        <td className="px-3 py-1.5 text-gray-900 dark:text-gray-50">{r.name || "—"}{r.role === "ADMIN" && <Pill tone="violet" className="ml-2">admin</Pill>}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.email || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.courseSlug ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right">{r.error ? <Pill tone="red">{r.error}</Pill> : <Pill tone="emerald">ok</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
              <Button type="button" disabled={!valid.length || valid.length > 200} isLoading={run.isPending} loadingText="Importando…"
                onClick={() => run.mutate()}>
                Importar {valid.length || ""} conta(s)
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
