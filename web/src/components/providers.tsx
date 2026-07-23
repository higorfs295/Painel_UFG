"use client";

// Provedores do cliente, montados uma vez no layout raiz.
//
// Estrutura herdada do visactor-next-template (mode-theme-provider + client providers) e
// do solid-nextjs (next-themes + toaster). Acrescenta o que este projeto precisa:
// TanStack Query e o bootstrap de sessão contra a API Fastify.
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { auth } from "@/lib/api/endpoints";
import { clearSessionHint, hadSession } from "@/lib/api/session-hint";
import { useAuth } from "@/lib/auth-store";
import { reportError } from "@/lib/monitoring";

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

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <SessionBootstrap>{children}</SessionBootstrap>
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!bg-popover !text-foreground !border !border-border !shadow-lg !text-sm",
            duration: 4000,
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
