"use client";

// Faixa de aviso da instância (v12) — escrita pelo admin em Configurações e mostrada no topo
// de todas as telas logadas (e nas de entrada). Fechar vale só para AQUELA mensagem: se o admin
// trocar o texto, a faixa volta.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RiCheckboxCircleLine, RiCloseLine, RiErrorWarningLine, RiInformationLine } from "@remixicon/react";
import { instance } from "@/lib/api/endpoints";
import { cx } from "@/lib/utils";
import type { Banner } from "@/lib/api/types";

const KEY = "painel-faixa-fechada";
const TONES = {
  info: { icon: RiInformationLine, cls: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100" },
  warning: { icon: RiErrorWarningLine, cls: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" },
  success: { icon: RiCheckboxCircleLine, cls: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100" },
} as const;

/** `preview` desenha uma faixa ainda não salva (Configurações), sem buscar nem permitir fechar. */
export function InstanceBanner({ className, preview }: { className?: string; preview?: Banner }) {
  const { data } = useQuery({ queryKey: ["public-settings"], queryFn: instance.publicSettings, staleTime: 60_000, enabled: !preview });
  const [closed, setClosed] = useState<string | null>(null);
  useEffect(() => { try { setClosed(localStorage.getItem(KEY)); } catch { /* sem storage */ } }, []);

  const banner = preview ?? data?.banner;
  if (!banner || (!preview && closed === banner.message)) return null;
  const t = TONES[banner.tone] ?? TONES.info;
  const Icon = t.icon;
  return (
    <div role={preview ? undefined : "status"} className={cx("flex items-start gap-2.5 border-b px-4 py-2.5 text-sm sm:px-6 lg:px-10", t.cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{banner.message}</p>
      {!preview && <button type="button" aria-label="Fechar aviso"
        onClick={() => { try { localStorage.setItem(KEY, banner.message); } catch { /* ok */ } setClosed(banner.message); }}
        className="-m-1 rounded-sm p-1 opacity-70 transition hover:opacity-100">
        <RiCloseLine className="size-4" aria-hidden="true" />
      </button>}
    </div>
  );
}
