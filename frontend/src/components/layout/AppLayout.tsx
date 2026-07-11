// Casca autenticada v5 — trilho lateral em desktop, gaveta com hambúrguer no mobile.
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
    <Card className="authcard" style={{ margin: "48px auto" }}>
      <h2>Escolha seu curso</h2>
      <p className="mut">Sua conta está pronta — selecione a matriz curricular para começar a acompanhar.</p>
      {!list ? <div className="spinner" role="status">Carregando cursos…</div> : list.length === 0 ? (
        <div className="muted-box">Nenhum curso cadastrado nesta instância ainda. Peça a um administrador
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
    <div className="page">
      <div className="orbs" aria-hidden="true"><span className="orb a" /><span className="orb b" /><span className="orb c" /></div>
      <a href="#conteudo" className="skiplink">Pular para o conteúdo</a>
      <div className={"shell" + (collapsed ? " collapsed" : "")}>
        <Sidebar onLogout={logout} open={navOpen} onClose={() => setNavOpen(false)}
          collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        {navOpen && <button className="scrim" aria-label="Fechar menu" onClick={() => setNavOpen(false)} />}
        <div className="shell-main">
          <Topbar enrollments={isAdmin ? [] : enrollments ?? []} selectedId={enrollmentId}
            onSelect={setEnrollment} onMenu={() => setNavOpen((v) => !v)} menuOpen={navOpen} />
          <main id="conteudo" className="content">
            {isAdmin ? <Outlet /> : studentBody}
            <footer className="foot" aria-hidden="true">
              <span className="foot-word">{APP_NAME}</span>
              <small>feito no cerrado · {new Date().getFullYear()}</small>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
