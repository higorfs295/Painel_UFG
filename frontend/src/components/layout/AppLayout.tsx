// Casca autenticada: carrega enrollments, mantém o curso selecionado e renderiza a página ativa.
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { me, auth } from "../../api/endpoints";
import { setAccessToken } from "../../api/client";
import { useAuth } from "../../store/auth";
import { useApp } from "../../store/app";
import AppHeader from "./AppHeader";

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
    <div className="app">
      <AppHeader
        enrollments={enrollments ?? []}
        selectedId={enrollmentId}
        onSelect={setEnrollment}
        onLogout={logout}
      />
      <div className="container page">
        {isLoading ? (
          <div className="spinner">Carregando cursos…</div>
        ) : !enrollments || enrollments.length === 0 ? (
          <div className="muted-box">
            Sua conta ainda não está matriculada em nenhum curso. Peça a um administrador para vincular um curso.
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
