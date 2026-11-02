"use client";

// Admin · Usuários (RF-01/21, v12): a tabela "Details" do template da Tremor com seleção e
// barra de comandos em lote, filtros, gaveta por usuário, convite e importação por CSV.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import toast from "react-hot-toast";
import {
  RiDownloadLine, RiFileUploadLine, RiMailSendLine, RiMoreFill, RiShieldUserLine, RiTeamLine, RiUserAddLine, RiUserFollowLine,
  RiUserForbidLine, RiUserUnfollowLine,
} from "@remixicon/react";
import { admin, courses } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth-store";
import { downloadCSV } from "@/lib/csv";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import {
  CommandBar, CommandBarBar, CommandBarCommand, CommandBarSeperator, CommandBarValue,
} from "@/components/tremor/CommandBar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/tremor/Dropdown";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/tremor/Dialog";
import { Button } from "@/components/tremor/Button";
import { Checkbox } from "@/components/tremor/Checkbox";
import { Searchbar } from "@/components/tremor/Searchbar";
import { Label } from "@/components/tremor/Label";
import { Segmented, selectCls } from "@/components/ui";
import { PageBanner } from "@/components/fx/page-banner";
import { CountUp } from "@/components/fx/count-up";
import { Pill } from "@/components/admin/panel";
import { Avatar, UserDrawer } from "@/components/admin/user-drawer";
import { ImportUsersDialog, InviteDialog } from "@/components/admin/user-dialogs";
import { hashTone, tone } from "@/lib/palette";
import { cx, timeAgo } from "@/lib/utils";
import type { AdminUser } from "@/lib/api/types";

const FILTERS = [
  { v: "all", label: "Todos" }, { v: "USER", label: "Alunos" }, { v: "ADMIN", label: "Admins" },
  { v: "pendentes", label: "Convite pendente" }, { v: "semcurso", label: "Sem curso" }, { v: "inativos", label: "Sem login há 30 dias" },
] as const;
type Filter = (typeof FILTERS)[number]["v"];
const col = createColumnHelper<AdminUser>();
const MONTH = 30 * 86_400_000;

export default function AdminUsuariosPage() {
  return <Suspense fallback={<div className="skeleton h-96" />}><UsersInner /></Suspense>;
}

function UsersInner() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const meId = useAuth((s) => s.user?.id);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [course, setCourse] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<AdminUser[] | null>(null);
  const [enrollFor, setEnrollFor] = useState<{ users: AdminUser[]; reset: () => void } | null>(null);
  const [enrollSlug, setEnrollSlug] = useState("");
  const [busy, setBusy] = useState(false);

  // atalhos vindos da Visão do sistema: ?novo=1 abre o convite, ?filtro=pendentes filtra
  useEffect(() => {
    if (params.get("novo")) setInviteOpen(true);
    if (params.get("filtro") === "pendentes") setFilter("pendentes");
  }, [params]);

  const users = useQuery({ queryKey: ["admin-users"], queryFn: admin.listUsers });
  const courseList = useQuery({ queryKey: ["courses"], queryFn: courses.list });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-analytics"] }); };

  const all = users.data ?? [];
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const now = Date.now();
    return all.filter((u) =>
      (!n || u.name.toLowerCase().includes(n) || u.email.toLowerCase().includes(n) || (u.matricula ?? "").toLowerCase().includes(n)) &&
      (!course || u.courses.some((c) => c.slug === course)) &&
      (filter === "all" ? true
        : filter === "pendentes" ? !u.active
        : filter === "semcurso" ? u.role === "USER" && u.courses.length === 0
        : filter === "inativos" ? u.active && (!u.lastLoginAt || now - new Date(u.lastLoginAt).getTime() > MONTH)
        : u.role === filter));
  }, [all, q, filter, course]);
  const openUser = all.find((u) => u.id === openId) ?? null;

  /** Executa uma ação para várias contas, uma de cada vez, e resume o resultado. */
  async function each(list: AdminUser[], fn: (u: AdminUser) => Promise<unknown>, done: string, reset?: () => void) {
    setBusy(true);
    let ok = 0;
    for (const u of list) { try { await fn(u); ok += 1; } catch { /* conta e segue */ } }
    setBusy(false); refresh(); reset?.();
    const failed = list.length - ok;
    if (failed) toast.error(`${ok} ok, ${failed} com erro.`); else toast.success(`${ok} ${done}.`);
  }

  const patchRole = useMutation({
    mutationFn: (v: { id: string; role: "ADMIN" | "USER" }) => admin.patchUser(v.id, { role: v.role }),
    onSuccess: () => { refresh(); toast.success("Papel alterado."); },
    onError: () => toast.error("Não foi possível alterar o papel."),
  });

  const columns = useMemo<ColumnDef<AdminUser, any>[]>(() => [
    col.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
          onCheckedChange={() => table.toggleAllPageRowsSelected()} className="translate-y-0.5" aria-label="Selecionar todos desta página" />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={() => row.toggleSelected()} className="translate-y-0.5"
          aria-label={`Selecionar ${row.original.name}`} />
      ),
    }),
    col.accessor("name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Usuário" />,
      cell: ({ row }) => (
        <button type="button" onClick={() => setOpenId(row.original.id)} className="flex items-center gap-3 py-1 text-left">
          <Avatar name={row.original.name} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-gray-900 hover:underline dark:text-gray-50">{row.original.name}</span>
            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{row.original.email}</span>
          </span>
        </button>
      ),
    }),
    col.accessor("role", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Papel" />,
      cell: ({ getValue }) => <Pill tone={getValue() === "ADMIN" ? "violet" : "emerald"}>{getValue() === "ADMIN" ? "Admin" : "Aluno"}</Pill>,
    }),
    col.accessor("active", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Situação" />,
      cell: ({ getValue }) => <Pill tone={getValue() ? "emerald" : "amber"}>{getValue() ? "Ativo" : "Convite pendente"}</Pill>,
    }),
    col.accessor((u) => u.courses.map((c) => c.slug).join(" "), {
      id: "cursos",
      header: () => "Cursos",
      enableSorting: false,
      cell: ({ row }) => row.original.courses.length === 0 ? <span className="text-gray-400">—</span> : (
        <div className="flex flex-wrap gap-1">
          {row.original.courses.map((c) => (
            <span key={c.enrollmentId} title={c.name}
              className={cx("rounded-sm px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", tone(hashTone(c.slug)).soft)}>{c.slug}</span>
          ))}
        </div>
      ),
    }),
    col.accessor((u) => (u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0), {
      id: "acesso",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Último login" />,
      cell: ({ row }) => (
        <span className="flex items-center gap-2 text-sm">
          {row.original.sessions > 0 && <span className="live-dot text-emerald-500" title={`${row.original.sessions} sessão(ões) aberta(s)`} />}
          {row.original.lastLoginAt ? timeAgo(row.original.lastLoginAt) : <span className="text-gray-400">nunca</span>}
        </span>
      ),
    }),
    col.display({
      id: "acoes",
      header: () => <span className="sr-only">Ações</span>,
      meta: { className: "text-right" },
      cell: ({ row }) => {
        const u = row.original; const self = u.id === meId;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" aria-label={`Ações de ${u.name}`}
                className="group aspect-square p-1.5 hover:border hover:border-gray-300 data-[state=open]:border-gray-300 data-[state=open]:bg-gray-50 dark:hover:border-gray-700 dark:data-[state=open]:border-gray-700 dark:data-[state=open]:bg-gray-900">
                <RiMoreFill className="size-4 shrink-0 text-gray-500" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={() => setOpenId(u.id)}>Abrir detalhes…</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => each([u], (x) => admin.reinvite(x.id), u.active ? "link de nova senha emitido" : "convite reenviado")}>
                {u.active ? "Enviar link de nova senha" : "Reenviar convite"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={self} onSelect={() => patchRole.mutate({ id: u.id, role: u.role === "ADMIN" ? "USER" : "ADMIN" })}>
                {u.role === "ADMIN" ? "Tornar aluno" : "Tornar administrador"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={self || u.sessions === 0} onSelect={() => each([u], (x) => admin.revokeSessions(x.id), "conta(s) com sessões encerradas")}>
                Encerrar sessões
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={self} onSelect={() => setConfirm([u])} className="text-red-600 dark:text-red-500">Remover conta…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ], [meId, patchRole]);

  const counts = {
    total: all.length,
    ativos: all.filter((u) => u.active).length,
    pendentes: all.filter((u) => !u.active).length,
    admins: all.filter((u) => u.role === "ADMIN").length,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageBanner eyebrow="Administração" icon={RiTeamLine} title="Usuários"
        description="Convide pessoas uma a uma ou pela planilha da turma, ajuste papéis e matrículas e acompanhe quem já acessou. Clique no nome para ver os detalhes."
        actions={<>
          <Button onClick={() => setInviteOpen(true)}><RiUserAddLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Convidar</Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}><RiFileUploadLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Importar CSV</Button>
          <Button variant="secondary" disabled={!rows.length} onClick={() => downloadCSV("usuarios", rows, [
            { header: "Nome", value: (u) => u.name }, { header: "E-mail", value: (u) => u.email },
            { header: "Matrícula", value: (u) => u.matricula ?? "" }, { header: "Turno", value: (u) => u.shift ?? "" },
            { header: "Papel", value: (u) => u.role }, { header: "Situação", value: (u) => (u.active ? "ativo" : "convite pendente") },
            { header: "Cursos", value: (u) => u.courses.map((c) => c.slug).join(" | ") },
            { header: "Último login", value: (u) => u.lastLoginAt ?? "" },
          ])}><RiDownloadLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Exportar</Button>
        </>}
        aside={
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {([["Contas", counts.total, RiTeamLine, "brand"], ["Ativas", counts.ativos, RiUserFollowLine, "emerald"],
               ["Pendentes", counts.pendentes, RiMailSendLine, "amber"], ["Admins", counts.admins, RiShieldUserLine, "violet"]] as const).map(([k, v, Icon, t]) => (
              <div key={k} className="flex items-center gap-2.5">
                <span aria-hidden="true" className={cx("grid size-8 place-items-center rounded-md ring-1 ring-inset", tone(t).soft)}><Icon className="size-4" /></span>
                <div><dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt><dd className="font-semibold text-gray-900 dark:text-gray-50"><CountUp value={v} /></dd></div>
              </div>
            ))}
          </dl>
        }
      />

      <section aria-label="Lista de usuários" className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs sm:p-5 dark:border-gray-800 dark:bg-gray-950">
        {users.isLoading ? <div className="skeleton h-80" /> : (
          <DataTable columns={columns} data={rows} getRowId={(u) => u.id} pageSize={15}
            empty={<span className="text-sm text-gray-500 dark:text-gray-400">Ninguém com esse filtro.</span>}
            toolbar={
              <div className="flex flex-wrap items-center gap-3">
                <Searchbar type="search" placeholder="Buscar nome, e-mail ou matrícula…" aria-label="Buscar usuário"
                  value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:max-w-xs" />
                <Segmented label="Filtrar usuários" value={filter} onChange={setFilter} options={[...FILTERS]} />
                <select aria-label="Filtrar por curso" value={course} onChange={(e) => setCourse(e.target.value)} className={cx(selectCls, "w-auto py-1.5")}>
                  <option value="">Todos os cursos</option>
                  {courseList.data?.map((c) => <option key={c.slug} value={c.slug}>{c.slug}</option>)}
                </select>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{rows.length} de {all.length}</span>
              </div>
            }
            bulk={({ rows: sel, reset }) => {
              const list = sel.map((r) => r.original).filter((u) => u.id !== meId);
              return (
                <CommandBar open={sel.length > 0}>
                  <CommandBarBar>
                    <CommandBarValue>{sel.length} selecionado(s)</CommandBarValue>
                    <CommandBarSeperator />
                    <CommandBarCommand label="Reenviar convite" disabled={busy} shortcut={{ shortcut: "r" }}
                      action={() => each(sel.map((r) => r.original).filter((u) => !u.active), (u) => admin.reinvite(u.id), "convite(s) reenviado(s)", reset)} />
                    <CommandBarSeperator />
                    <CommandBarCommand label="Matricular…" disabled={busy} shortcut={{ shortcut: "m" }}
                      action={() => { setEnrollSlug(""); setEnrollFor({ users: sel.map((r) => r.original), reset }); }} />
                    <CommandBarSeperator />
                    <CommandBarCommand label="Encerrar sessões" disabled={busy} shortcut={{ shortcut: "e" }}
                      action={() => each(list.filter((u) => u.sessions > 0), (u) => admin.revokeSessions(u.id), "conta(s) com sessões encerradas", reset)} />
                    <CommandBarSeperator />
                    <CommandBarCommand label="Remover" disabled={busy || !list.length} shortcut={{ shortcut: "x" }} action={() => setConfirm(list)} />
                    <CommandBarSeperator />
                    <CommandBarCommand label="Cancelar" shortcut={{ shortcut: "Escape", label: "esc" }} action={reset} />
                  </CommandBarBar>
                </CommandBar>
              );
            }}
          />
        )}
      </section>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <ImportUsersDialog open={importOpen} onOpenChange={setImportOpen} />
      <UserDrawer user={openUser} meId={meId} onClose={() => setOpenId(null)} onRemove={(u) => setConfirm([u])} />

      {/* matricular em lote */}
      <Dialog open={!!enrollFor} onOpenChange={(v) => { if (!v) setEnrollFor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Matricular {enrollFor?.users.length} pessoa(s)</DialogTitle>
            <DialogDescription>Quem já está no curso fica como está.</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Label htmlFor="lote-curso">Curso</Label>
            <select id="lote-curso" className={`${selectCls} mt-2`} value={enrollSlug} onChange={(e) => setEnrollSlug(e.target.value)}>
              <option value="">— escolha —</option>
              {courseList.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <DialogFooter className="mt-6">
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button disabled={!enrollSlug} isLoading={busy} onClick={() => {
              const f = enrollFor!; setEnrollFor(null);
              void each(f.users, (u) => admin.enrollUser(u.id, enrollSlug), "matrícula(s) criada(s)", f.reset);
            }}>Matricular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* remoção (uma ou várias) */}
      <Dialog open={!!confirm} onOpenChange={(v) => { if (!v) setConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RiUserForbidLine className="size-5 text-red-600" aria-hidden="true" />Remover {confirm?.length === 1 ? confirm[0]!.name : `${confirm?.length} contas`}?</DialogTitle>
            <DialogDescription>
              A conta e todo o progresso, agenda e cenários dela são apagados agora. Não há lixeira para contas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button variant="destructive" isLoading={busy} onClick={() => {
              const list = confirm ?? []; setConfirm(null); setOpenId(null);
              void each(list, (u) => admin.removeUser(u.id), "conta(s) removida(s)");
            }}><RiUserUnfollowLine className="mr-1.5 size-4" aria-hidden="true" />Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
