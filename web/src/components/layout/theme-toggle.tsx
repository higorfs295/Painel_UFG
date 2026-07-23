"use client";

// Alterna o tema pelo next-themes (o mecanismo do solid-nextjs / admin dashboard) e
// persiste a escolha no perfil do usuário (RF-15) — para que ela viaje entre dispositivos.
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { me } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth-store";
import { IconMoon, IconSun } from "@/components/ui/icons";
import { reportError } from "@/lib/monitoring";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const patchUser = useAuth((s) => s.patchUser);
  const signedIn = useAuth((s) => s.status === "in");
  const [mounted, setMounted] = useState(false);

  // até hidratar não sabemos o tema real; renderizar o ícone antes disso causa mismatch
  useEffect(() => setMounted(true), []);

  function toggle() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    if (!signedIn) return;
    patchUser({ theme: next });
    me.updateSettings({ theme: next }).catch(reportError); // persiste na próxima se falhar
  }

  return (
    <button onClick={toggle} title="Alternar tema" aria-label="Alternar tema"
      className="border-input text-muted-foreground hover:text-foreground hover:bg-muted grid cursor-pointer
                 place-items-center rounded-lg border p-1.5 transition-colors">
      {mounted && resolvedTheme === "light" ? <IconMoon /> : <IconSun />}
    </button>
  );
}
