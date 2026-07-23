"use client";

// Paleta de comandos (Ctrl/⌘+K). Lê o MESMO mapa de navegação da sidebar (nav-data),
// então nunca aparece um destino que o menu não tenha.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-store";
import { navFor } from "./nav-data";
import { IconSearch } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

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
  const { resolvedTheme, setTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const nav = navFor(user?.role).flatMap((section) =>
      section.items.map((item) => ({
        id: `nav:${item.href}`, label: item.label, group: section.label,
        hint: item.href, run: () => router.push(item.href),
      })));
    return [
      ...nav,
      {
        id: "theme", group: "Aparência",
        label: resolvedTheme === "dark" ? "Mudar para o tema claro" : "Mudar para o tema escuro",
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
    ];
  }, [user?.role, resolvedTheme, router, setTheme]);

  const results = useMemo(
    () => commands.filter((c) => fuzzy(q, `${c.group} ${c.label}`)),
    [commands, q]);

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
    <div className="fixed inset-0 z-[60] grid items-start justify-items-center bg-black/60 p-5 pt-[min(16vh,140px)] backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Paleta de comandos"
        className="bg-popover w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl">
        <div className="text-muted-foreground flex items-center gap-3 border-b px-4 py-3.5">
          <IconSearch />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); pick(results[cursor]); }
            }}
            placeholder="Buscar páginas e comandos…" aria-label="Buscar comandos"
            role="combobox" aria-expanded="true" aria-controls="palette-list"
            className="text-foreground flex-1 border-none bg-transparent p-0 text-base outline-none" />
          <kbd className="text-subtle-foreground rounded border px-1.5 py-0.5 font-mono text-[0.65rem]">esc</kbd>
        </div>

        <ul id="palette-list" role="listbox" ref={listRef} className="max-h-[min(52vh,420px)] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="text-muted-foreground px-4 py-6 text-center text-sm">Nada encontrado para “{q}”.</li>
          )}
          {results.map((c, i) => {
            const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
            return (
              <li key={c.id}>
                {head && (
                  <span className="text-subtle-foreground block px-2.5 pt-2.5 pb-1 text-[0.6rem] font-semibold tracking-[0.18em] uppercase">
                    {head}
                  </span>
                )}
                <button data-i={i} role="option" aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)} onClick={() => pick(c)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    i === cursor ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}>
                  <span>{c.label}</span>
                  {c.hint && (
                    <small className={cn("font-mono text-xs", i === cursor ? "text-primary-foreground/70" : "text-subtle-foreground")}>
                      {c.hint}
                    </small>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
