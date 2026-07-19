import { useAuth } from "../hooks/useAuth";
import { Avatar } from "../components/common/Avatar";
import { EmptyState } from "../components/common/EmptyState";
import styles from "./ProfilePage.module.css";

export function ProfilePage() {
  const { user, currentTenant } = useAuth();

  if (!user) return null;

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
        <EmptyState
          title="Edição de perfil ainda não implementada"
          message="O backend só expõe leitura do perfil (/auth/me) — não há endpoint de atualização ainda, então esta seção fica somente leitura tanto em Demo quanto em produção até esse endpoint existir."
        />
      </div>
    </div>
  );
}
