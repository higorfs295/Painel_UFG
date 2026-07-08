// Roteamento + guarda de autenticação. Rotas: /login, /convite/:token e área autenticada com abas.
import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { auth } from "./api/endpoints";
import { useAuth, applyTheme } from "./store/auth";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import InvitePage from "./pages/InvitePage";

// páginas autenticadas carregadas sob demanda (code-splitting)
const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const SubjectsPage = lazy(() => import("./pages/SubjectsPage"));
const ExtrasPage = lazy(() => import("./pages/ExtrasPage"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

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
          <Route path="/convite/:token" element={<InvitePage />} />
          <Route path="/reset/:token" element={<InvitePage />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<OverviewPage />} />
            <Route path="/disciplinas" element={<SubjectsPage />} />
            <Route path="/extras" element={<ExtrasPage />} />
            <Route path="/cronograma" element={<SchedulePage />} />
            <Route path="/config" element={<SettingsPage />} />
            <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
