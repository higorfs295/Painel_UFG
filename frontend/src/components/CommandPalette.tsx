// Paleta de comandos (Ctrl/⌘+K) — o atalho que substitui caçar o item certo no menu.
//
// Navega entre páginas, alterna o tema e dispara ações rápidas. A lista é consciente do papel:
// o aluno nunca vê comandos de administração, e vice-versa. O filtro é por subsequência
// (digitar "cro" acha "Cronograma"; "adus" acha "Admin · Usuários").
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, applyTheme } from "../store/auth";
import { me } from "../api/endpoints";
import { IconSearch } from "./ui/Icons";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
};

/** Abre a paleta de qualquer lugar (o botão do trilho usa isto) sem precisar de contexto. */
export const openPalette = () => window.dispatchEvent(new Event("palette:open"));

/** casa se as letras da busca aparecem em ordem no alvo (não precisa ser contíguo) */
function fuzzy(needle: string, hay: string): boolean {
  const n = needle.toLowerCase().replace(/\s+/g, "");
  if (!n) return true;
  const h = hay.toLowerCase();
  let i = 0;
  for (const ch of h) if (ch === n[i]) i++;
  return i === n.length;
}

const STUDENT_NAV: [string, string][] = [
  ["/", "Visão geral"], ["/disciplinas", "Disciplinas"], ["/extras", "Extras"],
  ["/cronograma", "Cronograma"], ["/recomendacoes", "Recomendações"],
  ["/historico", "Histórico"], ["/agenda", "Agenda"],
];
const ADMIN_NAV: [string, string][] = [
  ["/admin", "Visão do sistema"], ["/admin/usuarios", "Usuários"], ["/admin/cursos", "Cursos"],
  ["/admin/periodos", "Períodos"], ["/admin/avisos", "Avisos"], ["/admin/monitor", "Monitor"],
  ["/admin/config", "Configurações"],
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const patchUser = useAuth((s) => s.patchUser);
  const theme = user?.theme ?? "dark";
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const isAdmin = user?.role === "ADMIN";
    const nav = (isAdmin ? ADMIN_NAV : STUDENT_NAV).map(([to, label]) => ({
      id: `nav:${to}`, label, group: isAdmin ? "Administração" : "Ir para",
      hint: to, run: () => navigate(to),
    }));
    return [
      ...nav,
      { id: "nav:/config", label: "Ajustes da conta", group: "Conta", hint: "/config", run: () => navigate("/config") },
      { id: "nav:/ajuda", label: "Ajuda", group: "Conta", hint: "/ajuda", run: () => navigate("/ajuda") },
      {
        id: "theme", group: "Aparência",
        label: theme === "dark" ? "Mudar para o tema claro" : "Mudar para o tema escuro",
        run: () => {
          const next = theme === "dark" ? "light" : "dark";
          applyTheme(next);
          patchUser({ theme: next });
          void me.updateSettings({ theme: next }).catch(() => { /* persiste na próxima */ });
        },
      },
    ];
  }, [user?.role, theme, navigate, patchUser]);

  const results = useMemo(
    () => commands.filter((c) => fuzzy(q, `${c.group} ${c.label}`)),
    [commands, q]);

  // Ctrl/⌘+K abre; Esc fecha. Registrado uma vez, global.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("palette:open", onOpen);
    };
  }, []);

  useEffect(() => { if (open) { setQ(""); setCursor(0); inputRef.current?.focus(); } }, [open]);
  useEffect(() => { setCursor(0); }, [q]);
  // mantém o item selecionado visível ao navegar com as setas
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  function pick(cmd: Command | undefined) {
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(results[cursor]); }
  }

  let lastGroup = "";
  return (
    <div className="modal-scrim palette-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <div className="palette-input">
          <IconSearch />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Buscar páginas e comandos…" aria-label="Buscar comandos"
            role="combobox" aria-expanded="true" aria-controls="palette-list" />
          <kbd>esc</kbd>
        </div>
        <ul className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {results.length === 0 && <li className="palette-empty">Nada encontrado para “{q}”.</li>}
          {results.map((c, i) => {
            const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
            return (
              <li key={c.id}>
                {head && <span className="palette-group">{head}</span>}
                <button data-i={i} role="option" aria-selected={i === cursor}
                  className={"palette-item" + (i === cursor ? " on" : "")}
                  onMouseEnter={() => setCursor(i)} onClick={() => pick(c)}>
                  <span>{c.label}</span>
                  {c.hint && <small>{c.hint}</small>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
