import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../layouts/AuthLayout";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../constants/routes";
import { ChangePasswordForm } from "../components/auth/ChangePasswordForm";
import styles from "./LoginPage.module.css";

export function ResetPasswordPage() {
  const { confirmPasswordReset } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: { newPassword: string }) {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await confirmPasswordReset({ token, newPassword: values.newPassword });
      navigate(ROUTES.login);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className={styles.card}>
          <h2 className={styles.title}>Link inválido</h2>
          <p className={styles.subtitle}>Esse link de redefinição de senha não é válido.</p>
          <Link to={ROUTES.forgotPassword} className={styles.hint}>
            Solicitar novo link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className={styles.card}>
        <h2 className={styles.title}>Redefinir senha</h2>
        <p className={styles.subtitle}>Escolha uma nova senha para sua conta.</p>
        <ChangePasswordForm
          mode="reset"
          loading={loading}
          error={error}
          submitLabel="Redefinir senha"
          onSubmit={handleSubmit}
        />
        <Link to={ROUTES.login} className={styles.hint}>
          Voltar para o login
        </Link>
      </div>
    </AuthLayout>
  );
}
