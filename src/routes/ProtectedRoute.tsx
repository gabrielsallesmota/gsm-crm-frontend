import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../constants/routes";
import { AppLayout } from "../layouts/AppLayout";

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  // Sessão sendo restaurada: tela neutra com a marca, não uma página em
  // branco (Etapa 4).
  if (loading) {
    return (
      <div className="app-splash" role="status" aria-live="polite">
        <span className="sr-only">Carregando o CRM…</span>
      </div>
    );
  }
  if (!user) return <Navigate to={ROUTES.login} replace />;
  if (user.mustChangePassword) return <Navigate to={ROUTES.forcedPasswordChange} replace />;

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
