import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../constants/routes";
import { AppLayout } from "../layouts/AppLayout";

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to={ROUTES.login} replace />;
  if (user.mustChangePassword) return <Navigate to={ROUTES.forcedPasswordChange} replace />;

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
