"use client";

// Mapa de calor por dia (v12), no formato de calendário de contribuições: colunas = semanas,
// linhas = dias (seg–dom). Cinco níveis na cor de destaque; o número exato fica no title de
// cada quadradinho e no resumo acessível.
import { cx } from "@/lib/utils";

const LEVELS = [
  "bg-gray-100 dark:bg-gray-800/70",
  "bg-brand-200 dark:bg-brand-900",
  "bg-brand-300 dark:bg-brand-700",
  "bg-brand-500 dark:bg-brand-500",
  "bg-brand-700 dark:bg-brand-300",
];
const WEEKDAYS = ["seg", "", "qua", "", "sex", "", ""];
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

export function Heatmap({ data, unit = "acesso", label }: { data: { date: string; count: number }[]; unit?: string; label: string }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  // alinha a primeira coluna na segunda-feira
  const first = new Date(`${data[0]!.date}T00:00:00Z`);
  const pad = (first.getUTCDay() + 6) % 7;
  const cells: ({ date: string; count: number } | null)[] = [...Array(pad).fill(null), ...data];
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const total = data.reduce((s, d) => s + d.count, 0);
  const plural = (n: number) => `${n} ${unit}${n === 1 ? "" : "s"}`;

  return (
    <figure className="w-full overflow-x-auto">
      <div className="inline-flex gap-2">
        <div className="mt-5 grid grid-rows-7 gap-[3px] text-[0.6rem] leading-[13px] text-gray-500 dark:text-gray-400" aria-hidden="true">
          {WEEKDAYS.map((d, i) => <span key={i} className="h-[13px]">{d}</span>)}
        </div>
        <div>
          <div className="mb-1 flex gap-[3px] text-[0.6rem] text-gray-500 dark:text-gray-400" aria-hidden="true">
            {weeks.map((w, i) => {
              const firstDay = w.find(Boolean);
              const d = firstDay ? new Date(`${firstDay.date}T00:00:00Z`) : null;
              const show = d && d.getUTCDate() <= 7;
              return <span key={i} className="w-[13px] overflow-visible whitespace-nowrap">{show ? monthFmt.format(d) : ""}</span>;
            })}
          </div>
          <div className="stagger flex gap-[3px]" role="img" aria-label={`${label}: ${plural(total)} em ${data.length} dias`}>
            {weeks.map((w, i) => (
              <div key={i} className="grid grid-rows-7 gap-[3px]">
                {w.map((c, j) => c ? (
                  <span key={j} title={`${plural(c.count)} em ${fmt.format(new Date(`${c.date}T00:00:00Z`))}`}
                    className={cx("size-[13px] rounded-[3px] transition-transform hover:scale-125", LEVELS[level(c.count)])} />
                ) : <span key={j} className="size-[13px]" />)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-2 flex items-center justify-end gap-1.5 text-[0.65rem] text-gray-500 dark:text-gray-400">
        menos {LEVELS.map((l, i) => <span key={i} className={cx("size-[10px] rounded-[3px]", l)} aria-hidden="true" />)} mais
      </figcaption>
    </figure>
  );
}
