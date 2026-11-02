"use client";

// Gaveta de um usuário (v12): cadastro, cursos, acesso e atividade. Só dados de CONTA —
// progresso e notas do aluno não aparecem aqui (decisão de privacidade do projeto).
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { RiDeleteBinLine, RiLogoutBoxRLine, RiMailSendLine } from "@remixicon/react";
import { admin, courses } from "@/lib/api/endpoints";
import {
  Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/tremor/Drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/tremor/Tabs";
import { Button } from "@/components/tremor/Button";
import { Input } from "@/components/tremor/Input";
import { Label } from "@/components/tremor/Label";
import { selectCls } from "@/components/ui";
import { auditLabel } from "@/lib/audit-labels";
import { hashTone, tone } from "@/lib/palette";
import { cx, fmtDate, initials, timeAgo } from "@/lib/utils";
import { CopyLink } from "./user-dialogs";
import { Pill } from "./panel";
import type { AdminUser, Shift } from "@/lib/api/types";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const t = tone(hashTone(name));
  return (
    <span aria-hidden="true" className={cx(
      "grid shrink-0 place-items-center rounded-full font-semibold",
      t.solid, size === "sm" ? "size-7 text-[0.65rem]" : size === "lg" ? "size-14 text-lg" : "size-9 text-xs",
    )}>{initials(name)}</span>
  );
}

const SHIFTS: Shift[] = ["matutino", "vespertino", "noturno", "integral"];

export function UserDrawer({ user, meId, onClose, onRemove }: {
  user: AdminUser | null; meId: string | undefined; onClose: () => void; onRemove: (u: AdminUser) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", matricula: "", shift: "", role: "USER" as "USER" | "ADMIN" });
  const [pick, setPick] = useState("");
  const [link, setLink] = useState<{ link: string; emailed: boolean } | null>(null);
  useEffect(() => {
    if (user) setForm({ name: user.name, matricula: user.matricula ?? "", shift: user.shift ?? "", role: user.role });
    setLink(null);
  }, [user]);

  const courseList = useQuery({ queryKey: ["courses"], queryFn: courses.list, enabled: !!user });
  const activity = useQuery({
    queryKey: ["audit-user", user?.id], queryFn: () => admin.audit({ userId: user!.id, limit: 25 }), enabled: !!user,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-analytics"] }); };

  const save = useMutation({
    mutationFn: () => admin.patchUser(user!.id, {
      name: form.name, matricula: form.matricula.trim() || null, shift: (form.shift || null) as Shift | null,
      ...(form.role !== user!.role ? { role: form.role } : {}),
    }),
    onSuccess: () => { refresh(); toast.success("Cadastro atualizado."); },
    onError: () => toast.error("Não foi possível salvar (a própria conta não pode deixar de ser admin)."),
  });
  const enroll = useMutation({ mutationFn: (slug: string) => admin.enrollUser(user!.id, slug), onSuccess: () => { refresh(); setPick(""); toast.success("Matrícula criada."); } });
  const unenroll = useMutation({ mutationFn: (id: string) => admin.unenrollUser(user!.id, id), onSuccess: () => { refresh(); toast.success("Matrícula removida."); } });
  const reinvite = useMutation({ mutationFn: () => admin.reinvite(user!.id), onSuccess: (r) => { setLink(r.invite); toast.success("Novo link emitido."); } });
  const revoke = useMutation({
    mutationFn: () => admin.revokeSessions(user!.id),
    onSuccess: (r) => { refresh(); toast.success(`${r.revoked} sessão(ões) encerrada(s).`); },
    onError: () => toast.error("Não foi possível encerrar as sessões."),
  });

  const self = user?.id === meId;
  return (
    <Drawer open={!!user} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DrawerContent className="sm:max-w-xl">
        {user && (<>
          <DrawerHeader>
            <div className="flex items-center gap-3">
              <Avatar name={user.name} size="lg" />
              <div className="min-w-0">
                <DrawerTitle className="truncate">{user.name}</DrawerTitle>
                <DrawerDescription className="truncate">{user.email}</DrawerDescription>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill tone={user.role === "ADMIN" ? "violet" : "emerald"}>{user.role === "ADMIN" ? "Administrador" : "Aluno"}</Pill>
                  <Pill tone={user.active ? "emerald" : "amber"}>{user.active ? "Ativo" : "Convite pendente"}</Pill>
                  {self && <Pill tone="brand">Você</Pill>}
                </div>
              </div>
            </div>
          </DrawerHeader>
          <DrawerBody className="-mx-6 overflow-y-auto px-6">
            <Tabs defaultValue="perfil">
              <TabsList>
                <TabsTrigger value="perfil">Cadastro</TabsTrigger>
                <TabsTrigger value="cursos">Cursos ({user.courses.length})</TabsTrigger>
                <TabsTrigger value="acesso">Acesso</TabsTrigger>
                <TabsTrigger value="atividade">Atividade</TabsTrigger>
              </TabsList>

              <TabsContent value="perfil" className="mt-5">
                <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
                  <div className="sm:col-span-2">
                    <Label htmlFor="ud-nome">Nome</Label>
                    <Input id="ud-nome" className="mt-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="ud-matricula">Nº de matrícula</Label>
                    <Input id="ud-matricula" className="mt-2" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="ud-turno">Turno</Label>
                    <select id="ud-turno" className={`${selectCls} mt-2`} value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
                      <option value="">—</option>
                      {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="ud-papel">Papel</Label>
                    <select id="ud-papel" className={`${selectCls} mt-2`} value={form.role} disabled={self}
                      onChange={(e) => setForm({ ...form, role: e.target.value as "USER" | "ADMIN" })}>
                      <option value="USER">Aluno</option><option value="ADMIN">Administrador</option>
                    </select>
                    {self && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Você não pode tirar o próprio papel de admin.</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" isLoading={save.isPending} loadingText="Salvando…">Salvar cadastro</Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="cursos" className="mt-5 flex flex-col gap-4">
                {user.courses.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sem matrícula.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-900 dark:border-gray-800">
                    {user.courses.map((c) => (
                      <li key={c.enrollmentId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <span className={cx("size-2.5 shrink-0 rounded-full", tone(hashTone(c.slug)).dot)} aria-hidden="true" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-gray-900 dark:text-gray-50">{c.name}</span><span className="text-xs text-gray-500">{c.slug}</span></span>
                        <Button type="button" variant="ghost" className="text-red-700 dark:text-red-400" onClick={() => unenroll.mutate(c.enrollmentId)}
                          aria-label={`Desmatricular de ${c.slug}`}>Remover</Button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">Remover a matrícula apaga, junto, o progresso do aluno naquele curso.</p>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="ud-curso">Matricular em</Label>
                    <select id="ud-curso" className={`${selectCls} mt-2`} value={pick} onChange={(e) => setPick(e.target.value)}>
                      <option value="">— escolha um curso —</option>
                      {courseList.data?.filter((c) => !user.courses.some((x) => x.slug === c.slug)).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                    </select>
                  </div>
                  <Button type="button" disabled={!pick} isLoading={enroll.isPending} onClick={() => enroll.mutate(pick)}>Matricular</Button>
                </div>
              </TabsContent>

              <TabsContent value="acesso" className="mt-5 flex flex-col gap-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Conta criada", fmtDate.format(new Date(user.createdAt))],
                    ["Último login", user.lastLoginAt ? `${timeAgo(user.lastLoginAt)}` : "nunca"],
                    ["Sessões abertas", String(user.sessions)],
                    ["Senha", user.active ? "definida" : "aguardando convite"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
                      <dd className="mt-1 font-medium text-gray-900 dark:text-gray-50">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" isLoading={reinvite.isPending} onClick={() => reinvite.mutate()}>
                    <RiMailSendLine className="mr-1.5 size-4" aria-hidden="true" />{user.active ? "Enviar link de nova senha" : "Reenviar convite"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={self || user.sessions === 0} isLoading={revoke.isPending} onClick={() => revoke.mutate()}>
                    <RiLogoutBoxRLine className="mr-1.5 size-4" aria-hidden="true" />Encerrar sessões
                  </Button>
                </div>
                {link && <CopyLink link={link.link} emailed={link.emailed} />}
                {self && <p className="text-xs text-gray-500 dark:text-gray-400">As suas sessões se encerram em Ajustes &gt; Segurança.</p>}
              </TabsContent>

              <TabsContent value="atividade" className="mt-5">
                {activity.isLoading ? <div className="skeleton h-40" /> : !activity.data?.entries.length ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma ação registrada desta conta.</p>
                ) : (
                  <ol className="relative ml-3 border-l border-dashed border-gray-300 dark:border-gray-700">
                    {activity.data.entries.map((e) => {
                      const l = auditLabel(e); const Icon = l.icon;
                      return (
                        <li key={e.id} className="mb-3 ml-5">
                          <span className={cx("absolute -left-3.5 grid size-7 place-items-center rounded-full ring-4 ring-white dark:ring-gray-950", tone(l.tone).soft)}>
                            <Icon className="size-3.5" aria-hidden="true" />
                          </span>
                          <p className="text-sm text-gray-800 dark:text-gray-200">{l.line}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(e.createdAt)}{e.ip ? ` · ${e.ip}` : ""}</p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </TabsContent>
            </Tabs>
          </DrawerBody>
          <DrawerFooter className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-800">
            <Button type="button" variant="destructive" disabled={self} onClick={() => onRemove(user)}>
              <RiDeleteBinLine className="mr-1.5 size-4" aria-hidden="true" />Remover conta
            </Button>
          </DrawerFooter>
        </>)}
      </DrawerContent>
    </Drawer>
  );
}
