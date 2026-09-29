import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { usePageTitle } from "../hooks/usePageTitle";
import { resetOnboarding } from "../hooks/useOnboarding";
import { roleLabel } from "../auth/permissions";
import { Button } from "../components/common/Button";
import { Avatar } from "../components/common/Avatar";
import { ChangePasswordForm } from "../components/auth/ChangePasswordForm";
import styles from "./ProfilePage.module.css";
import { describeError } from "../utils/apiErrors";

export function ProfilePage() {
  const { user, currentTenantName, changePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  usePageTitle("Meu perfil");

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
      setError(describeError(err, "Não foi possível trocar a senha."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Meu perfil</h1>
      <p className={styles.pageSubtitle}>Seus dados de acesso</p>

      <div className={styles.card}>
        <Avatar name={user.name} bg="var(--tone-green-bg)" color="var(--tone-green)" size={56} />
        <div>
          <div className={styles.name}>{user.name}</div>
          <div className={styles.email}>{user.email}</div>
          <div className={styles.meta}>
            {roleLabel(user.role)} · {currentTenantName}
          </div>
        </div>
      </div>

      <div className={styles.editSection}>
        <h2 className={styles.sectionTitle}>Primeiros passos</h2>
        <p className={styles.pageSubtitle}>
          Pulou o tutorial? Reexiba o checklist de primeiros passos no Dashboard.
        </p>
        <Button
          onClick={() => {
            resetOnboarding(user.id, user.tenantId);
            toast("Os primeiros passos voltaram a aparecer no Dashboard.");
          }}
        >
          Mostrar primeiros passos
        </Button>
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
