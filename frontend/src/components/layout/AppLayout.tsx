// Casca autenticada v4 — dashboard com trilho lateral (sidebar) + barra superior,
// no espírito dos painéis de referência. Sem matrícula, oferece a escolha de curso (RF-17).
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { me, auth, courses } from "../../api/endpoints";
import { setAccessToken } from "../../api/client";
import { useAuth } from "../../store/auth";
import { useApp } from "../../store/app";
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
  const clear = useAuth((s) => s.clear);
  const { enrollmentId, setEnrollment } = useApp();

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn: me.enrollments,
  });

  // seleciona o primeiro curso assim que a lista chega
  useEffect(() => {
    if (enrollments && enrollments.length && !enrollmentId) setEnrollment(enrollments[0].id);
  }, [enrollments, enrollmentId, setEnrollment]);

  async function logout() {
    try { await auth.logout(); } catch { /* ignora */ }
    setAccessToken(null);
    clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="shell">
      <a href="#conteudo" className="skiplink">Pular para o conteúdo</a>
      <Sidebar onLogout={logout} />
      <div className="shell-main">
        <Topbar enrollments={enrollments ?? []} selectedId={enrollmentId} onSelect={setEnrollment} />
        <main id="conteudo" className="content">
          {isLoading ? (
            <div className="spinner" role="status" aria-live="polite">Carregando cursos…</div>
          ) : !enrollments || enrollments.length === 0 ? (
            <CoursePicker />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
