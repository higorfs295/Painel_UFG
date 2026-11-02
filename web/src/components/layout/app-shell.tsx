"use client";

// Casca das rotas autenticadas: guarda de sessão + sidebar + conteúdo.
//
// Layout do tremorlabs/template-dashboard (MIT): sidebar fixa de 18rem (`lg:w-72`) e o
// conteúdo em `lg:pl-72`, com o mesmo respiro do template (`p-4 sm:px-6 sm:pt-10
// lg:px-10 lg:pt-7`). Sem cabeçalho no desktop — a página começa no título, como lá.
//
// A guarda espera o bootstrap terminar ("loading") antes de decidir — sem isso um F5
// numa rota interna piscaria a tela de login. Papel errado é redirecionado: o ADMIN não
// cursa (não tem matrícula) e o aluno não administra.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auth, courses, me } from "@/lib/api/endpoints";
import { setAccessToken } from "@/lib/api/client";
import { clearSessionHint } from "@/lib/api/session-hint";
import { useApp, useAuth } from "@/lib/auth-store";
import { Button } from "@/components/tremor/Button";
import { Label } from "@/components/tremor/Label";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { selectCls } from "@/components/ui";

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
    <section aria-labelledby="escolha-curso" className="max-w-xl">
      <h1 id="escolha-curso">Escolha seu curso</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Sua conta está pronta — selecione a matriz curricular para começar a acompanhar.
      </p>
      {!list ? (
        <div className="skeleton mt-6 h-9" />
      ) : list.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
          Nenhum curso cadastrado nesta instância ainda. Peça a um administrador para importar uma matriz.
        </p>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (slug) enroll.mutate(slug); }}>
          <div>
            <Label htmlFor="curso-inicial" className="font-medium">Curso</Label>
            <select id="curso-inicial" value={slug} onChange={(e) => setSlug(e.target.value)} className={`${selectCls} mt-2`}>
              <option value="">— selecione —</option>
              {list.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          {enroll.isError && <p className="text-sm text-red-700 dark:text-red-400" role="alert">Não foi possível matricular. Tente novamente.</p>}
          <Button type="submit" className="w-fit" disabled={!slug} isLoading={enroll.isPending} loadingText="Matriculando…">
            Começar
          </Button>
        </form>
      )}
    </section>
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

  const { data: enrollments, isLoading, isError: enrollError, refetch } = useQuery({
    queryKey: ["enrollments"],
    queryFn: me.enrollments,
    enabled: status === "in" && !isAdmin, // admin não tem matrícula — nem busca
  });

  useEffect(() => {
    if (enrollments?.length && !enrollments.some((e) => e.id === enrollmentId)) setEnrollment(enrollments[0]!.id);
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
        <span className="text-sm text-gray-500 dark:text-gray-400">Carregando sua sessão…</span>
      </div>
    );
  }

  // só oferece "escolha seu curso" quando a lista VEIO vazia — uma falha de rede (ou um
  // 429 do limitador) não pode ser confundida com "não tem matrícula"
  const needsCourse = !isAdmin && !isLoading && !enrollError && (enrollments?.length ?? 0) === 0;

  let content: React.ReactNode = children;
  if (isLoading && !isAdmin) {
    content = (
      <div className="flex flex-col gap-6">
        <div className="skeleton h-7 w-56" />
        <div className="grid gap-14 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-40" />)}
        </div>
      </div>
    );
  } else if (enrollError && !isAdmin && !enrollments) {
    content = (
      <section className="max-w-xl">
        <h1>Não foi possível carregar seus cursos</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A API não respondeu. Verifique a conexão e tente de novo.</p>
        <Button variant="secondary" className="mt-6" onClick={() => refetch()}>Tentar novamente</Button>
      </section>
    );
  } else if (needsCourse) {
    content = <CoursePicker />;
  }

  return (
    <div className="mx-auto max-w-screen-2xl">
      <a href="#conteudo"
        className="absolute top-[-60px] left-3 z-[70] rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-md transition-[top] focus:top-3 dark:border-gray-800 dark:bg-gray-950">
        Pular para o conteúdo
      </a>
      <Sidebar enrollments={isAdmin ? [] : enrollments ?? []} onLogout={logout} />
      <main id="conteudo" className="lg:pl-72">
        <div className="relative p-4 sm:px-6 sm:pt-10 sm:pb-10 lg:px-10 lg:pt-7">{content}</div>
      </main>
      <CommandPalette />
    </div>
  );
}
