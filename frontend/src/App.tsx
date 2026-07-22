// Roteamento + guarda de autenticação. Rotas: /login, /convite/:token e área autenticada com abas.
import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { auth } from "./api/endpoints";
import { useAuth, applyTheme } from "./store/auth";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import InvitePage from "./pages/InvitePage";

// páginas autenticadas carregadas sob demanda (code-splitting)
const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const SubjectsPage = lazy(() => import("./pages/SubjectsPage"));
const ExtrasPage = lazy(() => import("./pages/ExtrasPage"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const RecommendationsPage = lazy(() => import("./pages/RecommendationsPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const AdminHomePage = lazy(() => import("./pages/admin/AdminHomePage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminCoursesPage = lazy(() => import("./pages/admin/AdminCoursesPage"));
const AdminPeriodsPage = lazy(() => import("./pages/admin/AdminPeriodsPage"));
const AdminConfigPage = lazy(() => import("./pages/admin/AdminConfigPage"));
const AdminMonitorPage = lazy(() => import("./pages/admin/AdminMonitorPage"));
const AdminAnnouncementsPage = lazy(() => import("./pages/admin/AdminAnnouncementsPage"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status === "anon") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Páginas de aluno não fazem sentido para o admin (ele não cursa) — vai para o painel dele.
function StudentPage({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  if (user?.role === "ADMIN") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export default function App() {
  const { status, setSession, clear } = useAuth();

  // boot: tenta renovar a sessão pelo cookie httpOnly
  useEffect(() => {
    let alive = true;
    auth.bootstrap().then((user) => {
      if (!alive) return;
      if (user) { setSession(user); applyTheme(user.theme); }
      else clear();
    });
    return () => { alive = false; };
  }, [setSession, clear]);

  if (status === "loading") return <div className="spinner" role="status" aria-live="polite">Carregando…</div>;

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="spinner" role="status" aria-live="polite">Carregando…</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/convite/:token" element={<InvitePage />} />
          <Route path="/reset/:token" element={<InvitePage />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<StudentPage><OverviewPage /></StudentPage>} />
            <Route path="/disciplinas" element={<StudentPage><SubjectsPage /></StudentPage>} />
            <Route path="/extras" element={<StudentPage><ExtrasPage /></StudentPage>} />
            <Route path="/cronograma" element={<StudentPage><SchedulePage /></StudentPage>} />
            <Route path="/recomendacoes" element={<StudentPage><RecommendationsPage /></StudentPage>} />
            <Route path="/historico" element={<StudentPage><HistoryPage /></StudentPage>} />
            <Route path="/agenda" element={<StudentPage><TasksPage /></StudentPage>} />
            <Route path="/config" element={<SettingsPage />} />
            <Route path="/ajuda" element={<HelpPage />} />
            <Route path="/admin" element={<RequireAdmin><AdminHomePage /></RequireAdmin>} />
            <Route path="/admin/usuarios" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
            <Route path="/admin/cursos" element={<RequireAdmin><AdminCoursesPage /></RequireAdmin>} />
            <Route path="/admin/periodos" element={<RequireAdmin><AdminPeriodsPage /></RequireAdmin>} />
            <Route path="/admin/config" element={<RequireAdmin><AdminConfigPage /></RequireAdmin>} />
            <Route path="/admin/monitor" element={<RequireAdmin><AdminMonitorPage /></RequireAdmin>} />
            <Route path="/admin/avisos" element={<RequireAdmin><AdminAnnouncementsPage /></RequireAdmin>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
