"use client";

// Barra superior do conteúdo — o `Layouts/header` do nextjs-admin-dashboard: hambúrguer,
// contexto à esquerda, e à direita o cluster de ações (busca, tema, usuário).
import { useQuery } from "@tanstack/react-query";
import { me } from "@/lib/api/endpoints";
import { useApp, useAuth } from "@/lib/auth-store";
import { Badge, Chip } from "@/components/ui";
import { IconCommand, IconMenu, IconX } from "@/components/ui/icons";
import { inputCls } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { openPalette } from "./command-palette";
import type { Enrollment } from "@/lib/api/types";

export function Header({ enrollments }: { enrollments: Enrollment[] }) {
  const { open, toggle } = useSidebar();
  const user = useAuth((s) => s.user);
  const { enrollmentId, setEnrollment } = useApp();

  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: me.profile, staleTime: 5 * 60_000 });
  const period = profile?.period ?? user?.period;
  const current = enrollments.find((e) => e.id === enrollmentId);

  return (
    <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <button onClick={toggle} aria-expanded={open} aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="border-input text-muted-foreground hover:text-foreground hover:bg-muted grid cursor-pointer
                     place-items-center rounded-lg border p-1.5 transition-colors lg:hidden">
          {open ? <IconX /> : <IconMenu />}
        </button>

        {current && <Badge className="hidden sm:inline-flex" title={current.course.name}>{current.course.slug}</Badge>}
        {enrollments.length > 1 && (
          <select value={enrollmentId ?? ""} onChange={(e) => setEnrollment(e.target.value)}
            aria-label="Selecionar curso" className={cn(inputCls, "max-w-[220px] py-1.5 text-xs")}>
            {enrollments.map((e) => <option key={e.id} value={e.id}>{e.course.name}</option>)}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          {period && (
            <Chip tone={period.onBreak ? "sim" : "avail"} className="hidden sm:inline-flex"
              // o período é global (RF-20 v2): vem do calendário mantido pelos admins
              title={period.onBreak ? `Próximo período: ${period.nextTerm}` : `Período corrente · depois: ${period.nextTerm}`}>
              {period.onBreak ? "Férias" : period.label}
            </Chip>
          )}
          <button onClick={openPalette} title="Paleta de comandos (Ctrl+K)"
            className="border-input text-muted-foreground hover:text-foreground hover:bg-muted inline-flex cursor-pointer
                       items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors">
            <IconCommand />
            <kbd className="hidden font-mono text-[0.65rem] sm:inline">Ctrl K</kbd>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
