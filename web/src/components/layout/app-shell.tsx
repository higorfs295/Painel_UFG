"use client";

// Casca das rotas autenticadas: guarda de sessão + sidebar + header + conteúdo.
//
// A guarda espera o bootstrap terminar ("loading") antes de decidir — sem isso um F5
// numa rota interna piscaria a tela de login. Papel errado é redirecionado: o ADMIN não
// cursa (não tem matrícula) e o aluno não administra.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { auth, courses, me } from "@/lib/api/endpoints";
import { setAccessToken } from "@/lib/api/client";
import { clearSessionHint } from "@/lib/api/session-hint";
import { useApp, useAuth } from "@/lib/auth-store";
import { APP_NAME } from "@/lib/branding";
import { Sidebar, SidebarProvider } from "./sidebar";
import { Header } from "./header";
import { CommandPalette } from "./command-palette";
import Button from "@/components/ui/button";
import { Card, EmptyState, Field, inputCls } from "@/components/ui";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Aluno recém-criado ainda não tem matrícula (RF-17): escolhe o curso aqui. */
function CoursePicker() {
  const qc = useQueryClient();
  const { data: list } = useQuery({ queryKey: ["courses"], queryFn: courses.list });
  const [slug, setSlug] = useState("");
  const enroll = useMutation({
    mutationFn: (s: string) => me.selfEnroll(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrollments"] }),
  });

  return (
    <Card className="mx-auto mt-12 w-full max-w-md">
      <h2>Escolha seu curso</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Sua conta está pronta — selecione a matriz curricular para começar a acompanhar.
      </p>
      {!list ? (
        <div className="skeleton mt-5 h-10" />
      ) : list.length === 0 ? (
        <EmptyState>
          Nenhum curso cadastrado nesta instância ainda. Peça a um administrador para importar uma matriz.
        </EmptyState>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <Field label="Curso">
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className={inputCls}>
              <option value="">— selecione —</option>
              {list.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
          {enroll.isError && <p className="text-lock text-sm" role="alert">Não foi possível matricular. Tente novamente.</p>}
          <Button variant="primary" disabled={!slug || enroll.isPending} onClick={() => enroll.mutate(slug)}>
            {enroll.isPending ? "Matriculando…" : "Começar"}
          </Button>
        </div>
      )}
    </Card>
  );
}

/** `any` = página compartilhada (Ajustes, Ajuda): serve aos dois papéis, sem redirecionar. */
export function AppShell({ area, children }: { area: "student" | "admin" | "any"; children: React.ReactNode }) {
  const router = useRouter();
  const { user, status, clear } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { enrollmentId, setEnrollment } = useApp();

  // guarda de rota
  useEffect(() => {
    if (status === "out") router.replace("/entrar");
    else if (status === "in" && area === "admin" && !isAdmin) router.replace("/painel");
    else if (status === "in" && area === "student" && isAdmin) router.replace("/admin");
  }, [status, area, isAdmin, router]);

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn: me.enrollments,
    enabled: status === "in" && !isAdmin, // admin não tem matrícula — nem busca
  });

  useEffect(() => {
    if (enrollments?.length && !enrollmentId) setEnrollment(enrollments[0]!.id);
  }, [enrollments, enrollmentId, setEnrollment]);

  async function logout() {
    try { await auth.logout(); } catch { /* ignora */ }
    setAccessToken(null);
    clearSessionHint();
    clear();
    router.replace("/entrar");
  }

  if (status !== "in") {
    return (
      <div className="grid min-h-svh place-items-center" role="status" aria-live="polite">
        <span className="text-muted-foreground text-sm">Carregando sua sessão…</span>
      </div>
    );
  }

  const needsCourse = !isAdmin && !isLoading && (enrollments?.length ?? 0) === 0;

  return (
    <SidebarProvider>
      <div className="bg-background flex min-h-svh">
        <a href="#conteudo"
          className="bg-card text-foreground absolute left-3 top-[-60px] z-[70] rounded-lg border px-4 py-2.5
                     shadow-md transition-[top] focus:top-3">
          Pular para o conteúdo
        </a>

        <Sidebar onLogout={logout} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header enrollments={isAdmin ? [] : enrollments ?? []} />

          <main id="conteudo" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {isLoading && !isAdmin ? (
              <div className="flex flex-col gap-4">
                <div className="skeleton h-9 w-64" />
                <div className="skeleton h-40" />
              </div>
            ) : needsCourse ? <CoursePicker /> : children}
          </main>

          <footer className={cn(
            "mx-auto flex w-full max-w-[1280px] items-baseline justify-between gap-4 border-t px-4 py-6 sm:px-6",
          )}>
            <Link href="/" className="font-display text-muted-foreground/60 hover:text-primary text-lg font-semibold tracking-tight">
              {APP_NAME}
            </Link>
            <small className="text-subtle-foreground text-[0.68rem] tracking-[0.16em] uppercase">
              feito no cerrado · {new Date().getFullYear()}
            </small>
          </footer>
        </div>

        <CommandPalette />
      </div>
    </SidebarProvider>
  );
}
