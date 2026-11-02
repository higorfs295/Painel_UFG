"use client";

// Ajustes > Aparência (v12): cor de destaque e pele da barra lateral. A escolha vale na hora
// (o <html> troca de data-accent/data-sidebar) e é salva na conta, como o tema.
import toast from "react-hot-toast";
import { RiCheckLine } from "@remixicon/react";
import { me } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth-store";
import { reportError } from "@/lib/monitoring";
import { ACCENTS, SIDEBARS, applyAppearance, useAppearance } from "@/lib/appearance";
import { cx } from "@/lib/utils";
import type { Accent, SidebarStyle } from "@/lib/api/types";
import { ProgressBar } from "@/components/tremor/ProgressBar";
import { Badge } from "@/components/tremor/Badge";
import { Button } from "@/components/tremor/Button";

function save(patch: { accent?: Accent; sidebar?: SidebarStyle }, patchUser: (p: object) => void) {
  applyAppearance(patch);
  patchUser(patch);
  me.updateSettings(patch).then(() => toast.success("Aparência salva na sua conta.")).catch((e) => {
    reportError(e);
    toast.error("Não foi possível salvar — a escolha vale só neste navegador por enquanto.");
  });
}

export function AccentPicker() {
  const { accent } = useAppearance();
  const patchUser = useAuth((s) => s.patchUser);
  return (
    <div role="radiogroup" aria-label="Cor de destaque" className="flex flex-wrap gap-3">
      {ACCENTS.map((a) => {
        const on = accent === a.value;
        return (
          <button key={a.value} type="button" role="radio" aria-checked={on} aria-label={a.label}
            onClick={() => save({ accent: a.value }, patchUser)}
            className={cx(
              "group flex flex-col items-center gap-1.5 rounded-lg p-1.5 text-xs font-medium text-gray-700 transition dark:text-gray-300",
              "outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2",
            )}>
            <span className={cx(
              "grid size-11 place-items-center rounded-full shadow-sm ring-offset-2 transition group-hover:scale-105 dark:ring-offset-gray-950",
              a.swatch, on ? "ring-2 ring-gray-900 dark:ring-gray-50" : "ring-0",
            )}>
              {on && <RiCheckLine className="size-5 text-white" aria-hidden="true" />}
            </span>
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

/** Miniatura de cada pele da barra lateral, desenhada com as mesmas classes da barra real. */
function SidebarThumb({ style }: { style: SidebarStyle }) {
  const bar = style === "light"
    ? "bg-white border-gray-200 dark:bg-gray-950 dark:border-gray-800"
    : style === "dark" ? "dark sb-dark border-gray-800" : "dark sb-color border-white/10";
  return (
    <div className="flex h-20 w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900" aria-hidden="true">
      <div className={cx("flex w-1/3 flex-col gap-1.5 border-r p-2", bar)}>
        <span className="h-2 w-8 rounded-sm bg-gray-300 dark:bg-gray-700" />
        <span className="h-1.5 w-10 rounded-sm bg-brand-600 dark:bg-brand-400" />
        <span className="h-1.5 w-7 rounded-sm bg-gray-200 dark:bg-gray-800" />
        <span className="h-1.5 w-9 rounded-sm bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="h-2 w-14 rounded-sm bg-gray-300 dark:bg-gray-700" />
        <span className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-800"><span className="block h-full w-2/3 rounded-full bg-brand-600 dark:bg-brand-500" /></span>
        <span className="h-1.5 w-3/4 rounded-full bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export function SidebarPicker() {
  const { sidebar } = useAppearance();
  const patchUser = useAuth((s) => s.patchUser);
  return (
    <div role="radiogroup" aria-label="Barra lateral" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {SIDEBARS.map((s) => {
        const on = sidebar === s.value;
        return (
          <button key={s.value} type="button" role="radio" aria-checked={on} onClick={() => save({ sidebar: s.value }, patchUser)}
            className={cx(
              "flex flex-col gap-2 rounded-lg border p-2.5 text-left text-sm shadow-xs transition hover:-translate-y-0.5",
              "outline-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2",
              on ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900",
            )}>
            <SidebarThumb style={s.value} />
            <span>
              <span className="block font-medium text-gray-900 dark:text-gray-50">{s.label}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{s.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Prévia ao vivo dos elementos que mudam com o destaque. */
export function AppearancePreview() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-700">
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">Prévia</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button">Botão principal</Button>
        <Button type="button" variant="secondary">Secundário</Button>
        <Badge variant="default">Selo</Badge>
        <a href="#aparencia" className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-400">Um link</a>
      </div>
      <ProgressBar value={62} className="mt-4" />
    </div>
  );
}
