import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Avatar } from "../components/common/Avatar";
import { ChangePasswordForm } from "../components/auth/ChangePasswordForm";
import styles from "./ProfilePage.module.css";

export function ProfilePage() {
  const { user, currentTenant, changePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!user) return null;

  async function handleChangePassword(values: { currentPassword?: string; newPassword: string }) {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await changePassword({
        currentPassword: values.currentPassword ?? "",
        newPassword: values.newPassword,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível trocar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Perfil</h1>
      <p className={styles.pageSubtitle}>Seus dados de acesso</p>

      <div className={styles.card}>
        <Avatar name={user.name} bg="rgba(46,230,110,.14)" color="#2ee66e" size={56} />
        <div>
          <div className={styles.name}>{user.name}</div>
          <div className={styles.email}>{user.email}</div>
          <div className={styles.meta}>
            {user.role} · {currentTenant?.name}
          </div>
        </div>
      </div>

      <div className={styles.editSection}>
        <h2 className={styles.sectionTitle}>Trocar senha</h2>
        {success && <div className={styles.success}>Senha atualizada com sucesso.</div>}
        <ChangePasswordForm
          mode="change"
          loading={loading}
          error={error}
          submitLabel="Trocar senha"
          onSubmit={handleChangePassword}
        />
      </div>
    </div>
  );
}
