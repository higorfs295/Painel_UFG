"use client";

// Admin · Auditoria (RF-27, v12): a trilha de ações sensíveis com busca livre (ação, alvo,
// nome ou e-mail de quem fez), filtro por grupo, intervalo de datas, "carregar mais" por
// cursor e exportação do que está na tela.
import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { RiDownloadLine, RiFileShield2Line, RiFilter3Line } from "@remixicon/react";
import { admin } from "@/lib/api/endpoints";
import { downloadCSV } from "@/lib/csv";
import { AUDIT_GROUPS, actorName, auditLabel } from "@/lib/audit-labels";
import { tone } from "@/lib/palette";
import { PageBanner } from "@/components/fx/page-banner";
import { EmptyArt } from "@/components/fx/art";
import { Pill } from "@/components/admin/panel";
import { Button } from "@/components/tremor/Button";
import { Input } from "@/components/tremor/Input";
import { Label } from "@/components/tremor/Label";
import { Searchbar } from "@/components/tremor/Searchbar";
import { Segmented } from "@/components/ui";
import { cx } from "@/lib/utils";
import type { AuditEntry } from "@/lib/api/types";

const full = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dayKey = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

export default function AdminAuditoriaPage() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<(typeof AUDIT_GROUPS)[number]["v"]>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useMemo(() => ({
    q: q.trim() || undefined, action: group || undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  }), [q, group, from, to]);

  const feed = useInfiniteQuery({
    queryKey: ["audit-search", query],
    queryFn: ({ pageParam }) => admin.audit({ ...query, limit: 50, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
  const entries = feed.data?.pages.flatMap((p) => p.entries) ?? [];

  // agrupa por dia para a linha do tempo
  const byDay = useMemo(() => {
    const out: { day: string; items: AuditEntry[] }[] = [];
    for (const e of entries) {
      const d = dayKey.format(new Date(e.createdAt));
      const last = out.at(-1);
      if (last?.day === d) last.items.push(e); else out.push({ day: d, items: [e] });
    }
    return out;
  }, [entries]);

  return (
    <div className="flex flex-col gap-6">
      <PageBanner eyebrow="Operação" icon={RiFileShield2Line} title="Auditoria" tone="blue"
        description="Logins, mudanças de papel, importações, avisos, configurações e relatórios abertos — quem, quando e de onde. Senhas e tokens nunca entram na trilha."
        actions={<Button variant="secondary" disabled={!entries.length} onClick={() => downloadCSV("auditoria", entries, [
          { header: "quando", value: (e) => e.createdAt }, { header: "ação", value: (e) => e.action },
          { header: "quem", value: (e) => e.user?.email ?? e.userId ?? "" }, { header: "alvo", value: (e) => (e.entity ? `${e.entity}:${e.entityId ?? ""}` : "") },
          { header: "ip", value: (e) => e.ip ?? "" }, { header: "detalhes", value: (e) => (e.meta ? JSON.stringify(e.meta) : "") },
        ])}><RiDownloadLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Exportar o que está na tela</Button>}
      />

      <section aria-label="Filtros" className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-72">
            <Label htmlFor="au-busca" className="sr-only">Buscar</Label>
            <Searchbar id="au-busca" type="search" placeholder="Ação, alvo, nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div><Label htmlFor="au-de" className="text-xs">De</Label><Input id="au-de" type="date" className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label htmlFor="au-ate" className="text-xs">Até</Label><Input id="au-ate" type="date" className="mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {(q || group || from || to) && <Button variant="light" onClick={() => { setQ(""); setGroup(""); setFrom(""); setTo(""); }}>Limpar filtros</Button>}
        </div>
        <div className="flex items-center gap-2">
          <RiFilter3Line className="size-4 text-gray-400" aria-hidden="true" />
          <Segmented label="Grupo de ações" value={group} onChange={setGroup} options={[...AUDIT_GROUPS]} />
        </div>
      </section>

      {feed.isLoading ? <div className="skeleton h-96" /> : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <EmptyArt icon={RiFileShield2Line} />
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Nada registrado com esses filtros.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {byDay.map(({ day, items }) => (
            <section key={day} aria-label={day}>
              <h2 className="sticky top-16 z-10 mb-3 inline-block rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 capitalize backdrop-blur lg:top-2 dark:border-gray-800 dark:bg-gray-950/90 dark:text-gray-300">{day}</h2>
              <ol className="relative ml-3 border-l border-dashed border-gray-300 dark:border-gray-700">
                {items.map((e) => {
                  const l = auditLabel(e); const Icon = l.icon;
                  return (
                    <li key={e.id} className="group mb-2 ml-6">
                      <span className={cx("absolute -left-3.5 mt-1.5 grid size-7 place-items-center rounded-full ring-4 ring-white dark:ring-gray-950", tone(l.tone).soft)}>
                        <Icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <div className="rounded-md px-3 py-2 transition group-hover:bg-gray-50 dark:group-hover:bg-gray-900">
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          <b className="font-medium text-gray-900 dark:text-gray-50">{actorName(e)}</b> {l.line}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          <time dateTime={e.createdAt}>{full.format(new Date(e.createdAt))}</time>
                          <Pill tone={l.tone}>{l.group}</Pill>
                          <code className="text-[0.7rem]">{e.action}</code>
                          {e.user?.email && <span>{e.user.email}</span>}
                          {e.ip && <span>IP {e.ip}</span>}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          <div className="flex justify-center">
            {feed.hasNextPage ? (
              <Button variant="secondary" isLoading={feed.isFetchingNextPage} loadingText="Carregando…" onClick={() => feed.fetchNextPage()}>Carregar mais</Button>
            ) : <p className="text-xs text-gray-500 dark:text-gray-400">Fim da trilha para esses filtros ({entries.length} registro(s)).</p>}
          </div>
        </div>
      )}
    </div>
  );
}
