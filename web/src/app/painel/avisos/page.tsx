"use client";

// Avisos da coordenação/administração (RF-24) para o aluno. Ao abrir a página, tudo o
// que está na tela passa a contar como lido (o número some da sidebar).
import { useEffect } from "react";
import { useAnnouncements } from "@/hooks/use-announcements";
import { Badge } from "@/components/tremor/Badge";
import { Divider } from "@/components/tremor/Divider";
import { fmtDate } from "@/lib/utils";

export default function AvisosPage() {
  const { data, isLoading, isNew, markAllSeen } = useAnnouncements();

  // marca como visto só depois que a lista chegou (senão zeraria antes de mostrar o "novo")
  useEffect(() => {
    if (!data?.length) return;
    const t = setTimeout(markAllSeen, 1500);
    return () => clearTimeout(t);
  }, [data, markAllSeen]);

  return (
    <>
      <h1>Avisos</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Comunicados publicados pela administração desta instância.</p>
      <Divider className="mt-4 sm:mt-6 lg:mt-10" />
      {isLoading ? (
        <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum aviso publicado.</p>
      ) : (
        <ul role="list" className="max-w-3xl divide-y divide-gray-200 dark:divide-gray-800">
          {data.map((a) => (
            <li key={a.id} className="py-5 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{a.title}</h2>
                {a.pinned && <Badge variant="default">fixado</Badge>}
                {isNew(a.createdAt) && <Badge variant="success">novo</Badge>}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {fmtDate.format(new Date(a.createdAt))}{a.author?.name ? ` · ${a.author.name}` : ""}
              </p>
              <p className="mt-3 text-sm leading-6 whitespace-pre-line text-gray-700 dark:text-gray-300">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
