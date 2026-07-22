// Casca autenticada v7 — trilho SUPERIOR + conteúdo em largura cheia (antes: barra lateral
// em gradiente e um "app-card" flutuante). Aluno sem matrícula cai na escolha de curso (RF-17);
// o ADMIN pula toda a lógica de matrícula — ele administra o sistema, não cursa.
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { me, auth, courses } from "../../api/endpoints";
import { setAccessToken } from "../../api/client";
import { useAuth } from "../../store/auth";
import { useApp } from "../../store/app";
import { APP_NAME } from "../../branding";
import TopNav from "./TopNav";
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

/** Curso selecionado + período letivo global (RF-20 v2), montados dentro do trilho. */
function RailContext({ enrollments, selectedId, onSelect }: {
  enrollments: { id: string; course: { name: string; slug: string } }[];
  selectedId: string | null; onSelect: (id: string) => void;
}) {
  const user = useAuth((s) => s.user);
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: me.profile, staleTime: 5 * 60_000 });
  const period = profile?.period ?? user?.period;
  const enr = enrollments.find((e) => e.id === selectedId);

  return (
    <>
      {enrollments.length > 1 ? (
        <select className="rail-course" value={selectedId ?? ""} onChange={(e) => onSelect(e.target.value)}
          aria-label="Selecionar curso">
          {enrollments.map((e) => <option key={e.id} value={e.id}>{e.course.name}</option>)}
        </select>
      ) : enr && <span className="badge hide-sm" title={enr.course.name}>{enr.course.slug}</span>}
      {period && (
        <span className={`chip ${period.onBreak ? "sim" : "avail"} hide-sm`}
          title={period.onBreak ? `Próximo período: ${period.nextTerm}` : `Período corrente · depois: ${period.nextTerm}`}>
          <span className="swatch" />{period.onBreak ? "Férias" : period.label}
        </span>
      )}
    </>
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
    <div className="v7">
      <a href="#conteudo" className="skiplink">Pular para o conteúdo</a>
      <TopNav onLogout={logout} open={navOpen}
        onToggle={() => setNavOpen((v) => !v)} onClose={() => setNavOpen(false)}>
        {!isAdmin && enrollments && enrollments.length > 0 && (
          <RailContext enrollments={enrollments} selectedId={enrollmentId} onSelect={setEnrollment} />
        )}
      </TopNav>

      <main id="conteudo" className="canvas">
        {/* a key da rota reinicia a animação de entrada a cada navegação */}
        <div key={location.pathname} className="route-enter">
          {isAdmin ? <Outlet /> : studentBody}
        </div>
      </main>

      <footer className="foot">
        <span className="foot-word">{APP_NAME}</span>
        <small>feito no cerrado · {new Date().getFullYear()}</small>
      </footer>

      <CommandPalette />
    </div>
  );
}
