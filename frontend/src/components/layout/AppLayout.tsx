// Casca autenticada v8 — trilho lateral (a estrutura da v6, que funcionava) reconstruída
// com Tailwind: sidebar sticky em desktop, gaveta com scrim no mobile, e o conteúdo numa
// coluna centrada com largura de leitura confortável.
//
// Aluno sem matrícula cai na escolha de curso (RF-17); o ADMIN pula toda a lógica de
// matrícula — ele administra o sistema, não cursa.
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { me, auth, courses } from "../../api/endpoints";
import { setAccessToken } from "../../api/client";
import { useAuth } from "../../store/auth";
import { useApp } from "../../store/app";
import { APP_NAME } from "../../branding";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CommandPalette from "../CommandPalette";
import Card from "../ui/Card";
import Button from "../ui/Button";

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
      <p className="mut mt-1 text-sm">Sua conta está pronta — selecione a matriz curricular para começar a acompanhar.</p>
      {!list ? <div className="spinner" role="status">Carregando cursos…</div> : list.length === 0 ? (
        <div className="muted-box mt-4">Nenhum curso cadastrado nesta instância ainda. Peça a um administrador
          para importar uma matriz.</div>
      ) : (
        <div className="stack mt">
          <label className="field">Curso
            <select value={slug} onChange={(e) => setSlug(e.target.value)}>
              <option value="">— selecione —</option>
              {list.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          {enroll.isError && <div className="err" role="alert">Não foi possível matricular. Tente novamente.</div>}
          <Button variant="prim" disabled={!slug || enroll.isPending} onClick={() => enroll.mutate(slug)}>
            {enroll.isPending ? "Matriculando…" : "Começar"}
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const clear = useAuth((s) => s.clear);
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const { enrollmentId, setEnrollment } = useApp();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("side-collapsed") === "1");

  function toggleCollapse() {
    setCollapsed((v) => { localStorage.setItem("side-collapsed", v ? "0" : "1"); return !v; });
  }

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn: me.enrollments,
    enabled: !isAdmin, // admin não tem matrícula — nem busca
  });

  // seleciona o primeiro curso assim que a lista chega
  useEffect(() => {
    if (enrollments && enrollments.length && !enrollmentId) setEnrollment(enrollments[0].id);
  }, [enrollments, enrollmentId, setEnrollment]);

  // fecha a gaveta a cada navegação (mobile)
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  async function logout() {
    try { await auth.logout(); } catch { /* ignora */ }
    setAccessToken(null);
    clear();
    navigate("/login", { replace: true });
  }

  const studentBody = isLoading
    ? <div className="spinner" role="status" aria-live="polite">Carregando cursos…</div>
    : !enrollments || enrollments.length === 0
      ? <CoursePicker />
      : <Outlet />;

  return (
    <div className="bg-background flex min-h-svh">
      <a href="#conteudo" className="skiplink">Pular para o conteúdo</a>

      <Sidebar onLogout={logout} open={navOpen} onClose={() => setNavOpen(false)}
        collapsed={collapsed} onToggleCollapse={toggleCollapse} />

      {navOpen && (
        <button aria-label="Fechar menu" onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-black/50 backdrop-blur-[2px] lg:hidden" />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar enrollments={isAdmin ? [] : enrollments ?? []} selectedId={enrollmentId}
          onSelect={setEnrollment} onMenu={() => setNavOpen((v) => !v)} menuOpen={navOpen} />

        <main id="conteudo" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {/* a key da rota reinicia a animação de entrada a cada navegação */}
          <div key={location.pathname} className="route-enter">
            {isAdmin ? <Outlet /> : studentBody}
          </div>
        </main>

        <footer className="mx-auto flex w-full max-w-[1280px] items-baseline justify-between gap-4
                           border-t px-4 py-6 sm:px-6">
          <span className="font-display text-muted-foreground/50 text-lg font-semibold tracking-tight">
            {APP_NAME}
          </span>
          <small className="text-subtle-foreground text-[0.68rem] tracking-[0.16em] uppercase">
            feito no cerrado · {new Date().getFullYear()}
          </small>
        </footer>
      </div>

      <CommandPalette />
    </div>
  );
}
