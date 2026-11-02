"use client";

// Paleta de comandos (Ctrl/⌘+K). Lê o MESMO mapa de navegação da sidebar (nav-data),
// então nunca aparece um destino que o menu não tenha. Pele do Tremor Raw Dialog/Dropdown:
// painel branco com borda fina, overlay black/30, itens com hover gray-100.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { RiSearchLine } from "@remixicon/react";
import { useAuth } from "@/lib/auth-store";
import { allNavFor } from "./nav-data";
import { cx } from "@/lib/utils";

export const openPalette = () => window.dispatchEvent(new Event("palette:open"));

type Command = { id: string; label: string; hint?: string; group: string; run: () => void };

/** Casa se as letras da busca aparecem em ordem no alvo (não precisa ser contíguo). */
function fuzzy(needle: string, hay: string) {
  const n = needle.toLowerCase().replace(/\s+/g, "");
  if (!n) return true;
  let i = 0;
  for (const ch of hay.toLowerCase()) if (ch === n[i]) i++;
  return i === n.length;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const { setTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const nav = allNavFor(user?.role).flatMap((section) =>
      section.items.map((item) => ({
        id: `nav:${item.href}`, label: item.label, group: section.label || "Páginas",
        hint: item.hint ?? item.href, run: () => router.push(item.href),
      })));
    return [
      ...nav,
      { id: "theme:light", group: "Tema", label: "Tema claro", run: () => setTheme("light") },
      { id: "theme:dark", group: "Tema", label: "Tema escuro", run: () => setTheme("dark") },
      { id: "theme:system", group: "Tema", label: "Seguir o sistema", run: () => setTheme("system") },
    ];
  }, [user?.role, router, setTheme]);

  const results = useMemo(() => commands.filter((c) => fuzzy(q, `${c.group} ${c.label}`)), [commands, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("palette:open", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("palette:open", onOpen); };
  }, []);

  useEffect(() => { if (open) { setQ(""); setCursor(0); inputRef.current?.focus(); } }, [open]);
  useEffect(() => { setCursor(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;
  const pick = (c: Command | undefined) => { if (!c) return; setOpen(false); c.run(); };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60] grid items-start justify-items-center bg-black/30 p-4 pt-[min(15vh,120px)] animate-dialog-overlay-show"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Paleta de comandos"
        className="w-full max-w-lg overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-900 dark:bg-gray-950">
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-800">
          <RiSearchLine className="size-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); pick(results[cursor]); }
            }}
            placeholder="Buscar páginas e comandos…" aria-label="Buscar comandos"
            role="combobox" aria-expanded="true" aria-controls="palette-list"
            className="h-11 flex-1 bg-transparent text-sm text-gray-900 outline-hidden placeholder:text-gray-500 dark:text-gray-50 dark:placeholder:text-gray-400" />
          <kbd className="rounded-sm border border-gray-200 px-1 text-[0.65rem] text-gray-500 dark:border-gray-800 dark:text-gray-400">esc</kbd>
        </div>

        <ul id="palette-list" role="listbox" ref={listRef} className="max-h-[min(55vh,420px)] overflow-y-auto p-1">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Nada encontrado para “{q}”.</li>
          )}
          {results.map((c, i) => {
            const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
            return (
              <li key={c.id}>
                {head && <span className="block px-2 pt-2.5 pb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{head}</span>}
                <button data-i={i} role="option" aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)} onClick={() => pick(c)}
                  className={cx(
                    "flex w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm text-gray-900 dark:text-gray-50",
                    i === cursor && "bg-gray-100 dark:bg-gray-900",
                  )}>
                  <span>{c.label}</span>
                  {c.hint && <span className="truncate text-xs text-gray-500 dark:text-gray-400">{c.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
