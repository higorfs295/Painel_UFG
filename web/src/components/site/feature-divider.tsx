// Divisor com os seis pontinhos — FeatureDivider do tremorlabs/template-solar (MIT).
import { cx } from "@/lib/utils";

const DOTS: [string, number][] = [["top-0 left-0", 0], ["top-0 left-4", 0], ["top-1 left-2", 2], ["top-2 left-0", 3], ["top-2 left-4", 3], ["top-3 left-2", 5]];

export function FeatureDivider({ className }: { className?: string }) {
  return (
    <div className={cx("mx-auto my-6 flex w-full items-center justify-between gap-3 text-sm text-gray-500", className)}>
      <div className="h-px w-full bg-gray-200" />
      <div className="relative h-4 w-5 shrink-0" aria-hidden="true">
        {DOTS.map(([pos, d], i) => (
          <div key={i} className={cx("absolute size-1 rounded-full bg-gray-300", pos)}
            style={{ animation: "wave 2s infinite ease-in-out", animationDelay: `${d * 0.2}s` }} />
        ))}
      </div>
      <div className="h-px w-full bg-gray-200" />
    </div>
  );
}

/** Guias tracejadas verticais (esquerda/direita/meio) usadas nas seções do template. */
export function DashedGuide({ className, mask = "linear-gradient(transparent, white 5rem, white calc(100% - 5rem), transparent)" }: { className?: string; mask?: string }) {
  return (
    <div className={cx("absolute inset-y-0 -my-20 w-px", className)} style={{ maskImage: mask }}>
      <svg className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="0" x2="0" y2="100%" className="stroke-gray-300" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
    </div>
  );
}

/** Hachura diagonal (o `diagonal-*-pattern` do template). */
export function DiagonalPattern({ id, className, stroke = "stroke-gray-200/70" }: { id: string; className?: string; stroke?: string }) {
  return (
    <svg className={cx("absolute size-full", className)} aria-hidden="true">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width="64" height="64">
          {Array.from({ length: 17 }, (_, i) => (
            <path key={i} d={`M${-106 + i * 8} 110L${22 + i * 8} -18`} className={stroke} strokeWidth="1" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
