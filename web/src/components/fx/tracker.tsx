"use client";

// Faixa de blocos de estado (o "Tracker" dos dashboards da Tremor), v12 — no Monitor, um bloco
// por minuto da última hora: verde sem erro, âmbar com 4xx, vermelho com 5xx, cinza sem tráfego.
import { cx } from "@/lib/utils";

export type TrackerBlock = { key: string; tone: "ok" | "warn" | "error" | "idle"; title: string };
const TONE = {
  ok: "bg-emerald-500 dark:bg-emerald-500",
  warn: "bg-amber-500 dark:bg-amber-500",
  error: "bg-red-600 dark:bg-red-500",
  idle: "bg-gray-200 dark:bg-gray-800",
};

export function Tracker({ data, label, className }: { data: TrackerBlock[]; label: string; className?: string }) {
  const counts = data.reduce((acc, b) => ({ ...acc, [b.tone]: (acc[b.tone] ?? 0) + 1 }), {} as Record<string, number>);
  return (
    <div role="img" className={cx("flex h-8 w-full items-stretch gap-[2px]", className)}
      aria-label={`${label}: ${counts.ok ?? 0} sem erro, ${counts.warn ?? 0} com erro do cliente, ${counts.error ?? 0} com erro do servidor, ${counts.idle ?? 0} sem tráfego`}>
      {data.map((b) => (
        <span key={b.key} title={b.title}
          className={cx("flex-1 rounded-[2px] transition-all first:rounded-l-md last:rounded-r-md hover:scale-y-110", TONE[b.tone])} />
      ))}
    </div>
  );
}
