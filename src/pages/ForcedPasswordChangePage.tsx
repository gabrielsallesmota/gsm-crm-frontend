import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthLayout } from "../layouts/AuthLayout";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../constants/routes";
import { ChangePasswordForm } from "../components/auth/ChangePasswordForm";
import styles from "./LoginPage.module.css";

export function ForcedPasswordChangePage() {
  const { user, loading: authLoading, markPasswordChanged, changePassword } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) return null;
  if (!user) return <Navigate to={ROUTES.login} replace />;

  async function handleSubmit(values: { currentPassword?: string; newPassword: string }) {
    setLoading(true);
    setError(null);
    try {
      await changePassword({
        currentPassword: values.currentPassword ?? "",
        newPassword: values.newPassword,
      });
      markPasswordChanged();
      navigate(ROUTES.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível trocar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className={styles.card}>
        <h2 className={styles.title}>Troque sua senha</h2>
        <p className={styles.subtitle}>
          Por segurança, defina uma nova senha antes de continuar. Use a senha temporária que
          você recebeu para se identificar.
        </p>
        <ChangePasswordForm
          mode="change"
          loading={loading}
          error={error}
          submitLabel="Confirmar"
          onSubmit={handleSubmit}
        />
      </div>
    </AuthLayout>
  );
}
