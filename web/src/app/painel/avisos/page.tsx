"use client";

// Avisos da coordenação/administração (RF-24) para o aluno. Ao abrir a página, tudo o
// que está na tela passa a contar como lido (o número some da sidebar). v12: cartões com a cor
// do público, selo do curso quando o aviso é só para ele e a data de publicação (agendamento).
import { useEffect } from "react";
import { RiMegaphoneLine, RiPushpin2Fill } from "@remixicon/react";
import { useAnnouncements } from "@/hooks/use-announcements";
import { PageBanner } from "@/components/fx/page-banner";
import { EmptyArt } from "@/components/fx/art";
import { Pill } from "@/components/admin/panel";
import { AUDIENCE_TONE, tone } from "@/lib/palette";
import { cx, fmtDate, timeAgo } from "@/lib/utils";

export default function AvisosPage() {
  const { data, isLoading, isNew, markAllSeen, unread } = useAnnouncements();

  // marca como visto só depois que a lista chegou (senão zeraria antes de mostrar o "novo")
  useEffect(() => {
    if (!data?.length) return;
    const t = setTimeout(markAllSeen, 1500);
    return () => clearTimeout(t);
  }, [data, markAllSeen]);

  return (
    <>
      <PageBanner eyebrow="Comunicação" icon={RiMegaphoneLine} title="Avisos" tone="amber"
        description="Comunicados publicados pela administração desta instância — para todos ou só para o seu curso."
        aside={data && data.length > 0 ? (
          <div className="flex gap-3">
            <div className="rounded-lg border border-gray-200 bg-white/70 px-4 py-2 text-center dark:border-gray-800 dark:bg-gray-950/60">
              <span className="block text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{data.length}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">no ar</span>
            </div>
            {unread > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
                <span className="block text-xl font-semibold tabular-nums text-amber-800 dark:text-amber-300">{unread}</span>
                <span className="text-xs text-amber-800 dark:text-amber-300">novo(s)</span>
              </div>
            )}
          </div>
        ) : undefined}
      />
      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
            <EmptyArt icon={RiMegaphoneLine} />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Nenhum aviso publicado.</p>
          </div>
        ) : (
          <ul role="list" className="stagger flex max-w-3xl flex-col gap-4">
            {data.map((a) => {
              const when = a.publishAt ?? a.createdAt;
              const fresh = isNew(when);
              return (
                <li key={a.id} className={cx(
                  "relative overflow-hidden rounded-lg border bg-white p-5 shadow-xs dark:bg-gray-950",
                  fresh ? "border-amber-300 dark:border-amber-500/40" : "border-gray-200 dark:border-gray-800",
                )}>
                  <span aria-hidden="true" className={cx("absolute inset-y-0 left-0 w-1", tone(AUDIENCE_TONE[a.audience]).dot)} />
                  <div className="flex flex-wrap items-center gap-2">
                    {a.pinned && <RiPushpin2Fill className="size-4 text-brand-600 dark:text-brand-400" aria-label="fixado" />}
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{a.title}</h2>
                    {fresh && <Pill tone="amber">novo</Pill>}
                    {a.course && <Pill tone="cyan">{a.course.slug}</Pill>}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400" title={fmtDate.format(new Date(when))}>
                    {timeAgo(when)}{a.author?.name ? ` · ${a.author.name}` : ""}{a.expiresAt ? ` · até ${fmtDate.format(new Date(a.expiresAt))}` : ""}
                  </p>
                  <p className="mt-3 text-sm leading-6 whitespace-pre-line text-gray-700 dark:text-gray-300">{a.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
