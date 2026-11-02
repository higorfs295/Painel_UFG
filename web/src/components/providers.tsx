"use client";

// Provedores do cliente, montados uma vez no layout raiz.
//
// next-themes com `defaultTheme="system"`, como no tremorlabs/template-dashboard: sem
// escolha salva, o painel segue o tema do sistema operacional. A escolha da pessoa
// (Claro/Escuro/Sistema) vive na conta (RF-15) e é aplicada ao entrar.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { auth } from "@/lib/api/endpoints";
import { clearSessionHint, hadSession } from "@/lib/api/session-hint";
import { useAuth } from "@/lib/auth-store";
import { reportError } from "@/lib/monitoring";
import { applyAppearance } from "@/lib/appearance";

/**
 * Tenta restaurar a sessão pelo cookie de refresh assim que o app monta.
 * Enquanto isso `status` fica em "loading" e as rotas protegidas seguram a renderização.
 */
function SessionBootstrap({ children }: { children: React.ReactNode }) {
  const setUser = useAuth((s) => s.setUser);
  const user = useAuth((s) => s.user);
  const { setTheme } = useTheme();

  useEffect(() => {
    let alive = true;
    // sem pista de sessão anterior, nem tenta renovar (ver session-hint.ts)
    if (!hadSession()) { setUser(null); return; }
    auth.bootstrap()
      .then((u) => { if (alive) { if (!u) clearSessionHint(); setUser(u); } })
      .catch((err) => { reportError(err); if (alive) setUser(null); });
    return () => { alive = false; };
  }, [setUser]);

  // o tema é uma preferência do usuário guardada no servidor (RF-15): ao entrar,
  // ele manda no next-themes
  useEffect(() => {
    if (user?.theme) setTheme(user.theme);
  }, [user?.theme, setTheme]);

  // v12: cor de destaque e pele da barra lateral também moram na conta
  useEffect(() => {
    if (user) applyAppearance({ accent: user.accent ?? "orange", sidebar: user.sidebar ?? "light" });
  }, [user]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
      },
    }),
  );

  // o site público (template-solar) é claro por desenho: componentes Tremor dentro dele
  // têm variantes `dark:` que, com o sistema no escuro, poriam texto claro em fundo claro
  const pathname = usePathname();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange
      forcedTheme={pathname === "/" ? "light" : undefined}>
      <QueryClientProvider client={queryClient}>
        <SessionBootstrap>{children}</SessionBootstrap>
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!rounded-md !border !border-gray-200 !bg-white !text-sm !text-gray-900 !shadow-lg dark:!border-gray-800 dark:!bg-gray-950 dark:!text-gray-50",
            duration: 4000,
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
