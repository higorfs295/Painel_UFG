"use client";

// Admin · Avisos (RF-24, v12): comunicados por público e por CURSO, com agendamento e
// validade. A lista mostra o que está no ar, o que vai entrar e o que já saiu; o formulário
// tem prévia de como o aviso aparece para quem lê.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  RiCalendarScheduleLine, RiDeleteBinLine, RiEditLine, RiMegaphoneLine, RiPushpin2Fill, RiPushpinLine, RiTimerLine,
} from "@remixicon/react";
import { announcements, courses, type AnnouncementInput } from "@/lib/api/endpoints";
import { PageBanner } from "@/components/fx/page-banner";
import { EmptyArt } from "@/components/fx/art";
import { Pill } from "@/components/admin/panel";
import { Button } from "@/components/tremor/Button";
import { Input } from "@/components/tremor/Input";
import { Label } from "@/components/tremor/Label";
import { Switch } from "@/components/tremor/Switch";
import { Textarea } from "@/components/tremor/Textarea";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/tremor/Dialog";
import { Segmented, selectCls } from "@/components/ui";
import { AUDIENCE_TONE, tone } from "@/lib/palette";
import { cx, timeAgo } from "@/lib/utils";
import type { Announcement, Audience } from "@/lib/api/types";

const AUDIENCE_LABEL: Record<Audience, string> = { ALL: "Todos", STUDENTS: "Alunos", ADMINS: "Admins" };
const STATUS = { live: { label: "No ar", tone: "emerald" }, scheduled: { label: "Agendado", tone: "blue" }, expired: { label: "Expirado", tone: "gray" } } as const;
const FILTERS = [{ v: "all", label: "Todos" }, { v: "live", label: "No ar" }, { v: "scheduled", label: "Agendados" }, { v: "expired", label: "Expirados" }] as const;
const dt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** "2026-11-02T10:30" (o formato do input datetime-local) no fuso do navegador. */
const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso); const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

type Form = { title: string; body: string; audience: Audience; pinned: boolean; courseSlug: string; publishAt: string; expiresAt: string };
const EMPTY: Form = { title: "", body: "", audience: "ALL", pinned: false, courseSlug: "", publishAt: "", expiresAt: "" };

export default function AdminAvisosPage() {
  return <Suspense fallback={<div className="skeleton h-96" />}><AvisosInner /></Suspense>;
}

function AvisosInner() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["v"]>("all");
  useEffect(() => { if (params.get("novo")) { setEditing(null); setForm(EMPTY); setOpen(true); } }, [params]);

  const list = useQuery({ queryKey: ["admin-announcements"], queryFn: announcements.listAll });
  const courseList = useQuery({ queryKey: ["courses"], queryFn: courses.list });
  const refresh = () => {
    for (const k of [["admin-announcements"], ["announcements"], ["admin-analytics"]]) qc.invalidateQueries({ queryKey: k });
  };

  const payload = (): AnnouncementInput => ({
    title: form.title.trim(), body: form.body.trim(), audience: form.audience, pinned: form.pinned,
    courseSlug: form.courseSlug || null,
    ...(form.publishAt ? { publishAt: new Date(form.publishAt).toISOString() } : {}),
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
  });
  const save = useMutation({
    mutationFn: () => (editing ? announcements.update(editing.id, payload()) : announcements.create(payload())),
    onSuccess: (a) => {
      refresh(); setOpen(false);
      toast.success(a.status === "scheduled" ? "Aviso agendado." : editing ? "Aviso atualizado." : "Aviso publicado.");
    },
    onError: () => toast.error("Confira o título, o texto e as datas (a validade precisa vir depois da publicação)."),
  });
  const remove = useMutation({ mutationFn: (id: string) => announcements.remove(id), onSuccess: () => { refresh(); toast.success("Aviso removido."); } });
  const pin = useMutation({ mutationFn: (a: Announcement) => announcements.update(a.id, { pinned: !a.pinned }), onSuccess: refresh });

  function startEdit(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title, body: a.body, audience: a.audience, pinned: a.pinned, courseSlug: a.course?.slug ?? "",
      publishAt: toLocalInput(a.publishAt), expiresAt: toLocalInput(a.expiresAt),
    });
    setOpen(true);
  }

  const all = list.data ?? [];
  const rows = useMemo(() => all.filter((a) => filter === "all" || a.status === filter), [all, filter]);
  const count = (s: Announcement["status"]) => all.filter((a) => a.status === s).length;

  return (
    <div className="flex flex-col gap-6">
      <PageBanner eyebrow="Comunicação" icon={RiMegaphoneLine} title="Avisos"
        description="Comunicados para todos, só alunos ou só admins — e, se quiser, só para um curso. Agende a entrada e defina até quando o aviso fica no ar."
        actions={<Button onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }}><RiMegaphoneLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Novo aviso</Button>}
        aside={
          <div className="flex gap-3">
            {(["live", "scheduled", "expired"] as const).map((s) => (
              <div key={s} className="rounded-lg border border-gray-200 bg-white/70 px-4 py-2 text-center dark:border-gray-800 dark:bg-gray-950/60">
                <span className="block text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{count(s)}</span>
                <Pill tone={STATUS[s].tone}>{STATUS[s].label}</Pill>
              </div>
            ))}
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Filtrar avisos" value={filter} onChange={setFilter} options={[...FILTERS]} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{rows.length} aviso(s)</span>
      </div>

      {list.isLoading ? <div className="skeleton h-64" /> : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <EmptyArt icon={RiMegaphoneLine} />
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Nenhum aviso com esse filtro.</p>
        </div>
      ) : (
        <ul className="stagger grid gap-4 lg:grid-cols-2">
          {rows.map((a) => {
            const st = STATUS[a.status];
            return (
              <li key={a.id} className={cx(
                "relative flex flex-col overflow-hidden rounded-lg border bg-white p-5 shadow-xs transition-shadow hover:shadow-md dark:bg-gray-950",
                a.pinned ? "border-brand-300 dark:border-brand-500/40" : "border-gray-200 dark:border-gray-800",
                a.status === "expired" && "opacity-70",
              )}>
                <span aria-hidden="true" className={cx("absolute inset-y-0 left-0 w-1", tone(AUDIENCE_TONE[a.audience]).dot)} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={st.tone}>{st.label}</Pill>
                  <Pill tone={AUDIENCE_TONE[a.audience]}>{AUDIENCE_LABEL[a.audience]}</Pill>
                  {a.course && <Pill tone="cyan">{a.course.slug}</Pill>}
                  {a.pinned && <Pill tone="brand">fixado</Pill>}
                </div>
                <h2 className="mt-3 font-semibold text-gray-900 dark:text-gray-50">{a.title}</h2>
                <p className="mt-1 line-clamp-3 text-sm whitespace-pre-line text-gray-600 dark:text-gray-400">{a.body}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><RiCalendarScheduleLine className="size-3.5" aria-hidden="true" />
                    {a.status === "scheduled" ? `entra ${dt.format(new Date(a.publishAt))}` : `publicado ${timeAgo(a.publishAt)}`}</span>
                  {a.expiresAt && <span className="flex items-center gap-1"><RiTimerLine className="size-3.5" aria-hidden="true" />{a.status === "expired" ? "saiu" : "sai"} {dt.format(new Date(a.expiresAt))}</span>}
                  {a.author?.name && <span>por {a.author.name}</span>}
                </div>
                <div className="mt-4 flex gap-1 border-t border-dashed border-gray-200 pt-3 dark:border-gray-800">
                  <Button variant="ghost" className="px-2 text-xs" onClick={() => pin.mutate(a)} aria-label={a.pinned ? `Desafixar ${a.title}` : `Fixar ${a.title}`}>
                    {a.pinned ? <RiPushpin2Fill className="mr-1 size-3.5" aria-hidden="true" /> : <RiPushpinLine className="mr-1 size-3.5" aria-hidden="true" />}{a.pinned ? "Desafixar" : "Fixar"}
                  </Button>
                  <Button variant="ghost" className="px-2 text-xs" onClick={() => startEdit(a)}><RiEditLine className="mr-1 size-3.5" aria-hidden="true" />Editar</Button>
                  <Button variant="ghost" className="ml-auto px-2 text-xs text-red-700 dark:text-red-400" onClick={() => remove.mutate(a.id)} aria-label={`Remover ${a.title}`}>
                    <RiDeleteBinLine className="mr-1 size-3.5" aria-hidden="true" />Remover
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar aviso" : "Novo aviso"}</DialogTitle>
            <DialogDescription>Sem data de publicação, entra agora. Sem validade, fica no ar até alguém remover.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid max-h-[70vh] gap-6 overflow-y-auto md:grid-cols-5">
            <form id="aviso-form" className="flex flex-col gap-4 md:col-span-3" onSubmit={(e) => { e.preventDefault(); if (form.title.trim() && form.body.trim()) save.mutate(); }}>
              <div><Label htmlFor="av-titulo">Título</Label><Input id="av-titulo" className="mt-2" required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label htmlFor="av-texto">Texto</Label><Textarea id="av-texto" className="mt-2" rows={5} required maxLength={4000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="av-publico">Público</Label>
                  <select id="av-publico" className={`${selectCls} mt-2`} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Audience })}>
                    <option value="ALL">Todos</option><option value="STUDENTS">Só alunos</option><option value="ADMINS">Só admins</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="av-curso">Curso</Label>
                  <select id="av-curso" className={`${selectCls} mt-2`} value={form.courseSlug} onChange={(e) => setForm({ ...form, courseSlug: e.target.value })}>
                    <option value="">Todos os cursos</option>
                    {courseList.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
                <div><Label htmlFor="av-inicio">Publicar em</Label><Input id="av-inicio" type="datetime-local" className="mt-2" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} /></div>
                <div><Label htmlFor="av-fim">Sai do ar em</Label><Input id="av-fim" type="datetime-local" className="mt-2" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <Switch checked={form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: v })} aria-label="Fixar no topo" />
                Fixar no topo do feed
              </label>
            </form>
            <div className="md:col-span-2">
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">Prévia</p>
              <div className="relative mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-950">
                <span aria-hidden="true" className={cx("absolute inset-y-0 left-0 w-1", tone(AUDIENCE_TONE[form.audience]).dot)} />
                <div className="flex flex-wrap gap-1.5">
                  {form.pinned && <Pill tone="brand">fixado</Pill>}
                  {form.courseSlug && <Pill tone="cyan">{form.courseSlug}</Pill>}
                </div>
                <p className="mt-2 font-semibold text-gray-900 dark:text-gray-50">{form.title || "Título do aviso"}</p>
                <p className="mt-1 text-sm whitespace-pre-line text-gray-600 dark:text-gray-400">{form.body || "O texto aparece aqui, como os alunos vão ler."}</p>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{form.publishAt ? `entra ${dt.format(new Date(form.publishAt))}` : "entra agora"}{form.expiresAt ? ` · sai ${dt.format(new Date(form.expiresAt))}` : ""}</p>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
            <Button type="submit" form="aviso-form" isLoading={save.isPending} loadingText="Salvando…">{editing ? "Salvar" : form.publishAt && new Date(form.publishAt) > new Date() ? "Agendar" : "Publicar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
