import { NavLink, Navigate, Outlet, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../constants/routes";
import { can } from "../auth/permissions";
import { isDemoMode } from "../services/factory";
import { ToastHost } from "../components/common/ToastHost";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { EmptyState } from "../components/common/EmptyState";
import { NotFoundPage } from "../routes/RequirePermission";
import styles from "./Platform.module.css";

const NAV = [
  { to: ROUTES.platform, label: "Visão geral", end: true },
  { to: ROUTES.platformOrganizations, label: "Organizações", end: false },
  { to: ROUTES.platformSessions, label: "Sessões de suporte", end: false },
  { to: ROUTES.platformAudit, label: "Auditoria", end: false },
];

/**
 * Área do Super Admin GSM (control plane) — rota e layout PRÓPRIOS, fora do
 * `AppLayout` do CRM. Quem não é platform staff recebe "Página não
 * encontrada" (não revela que a área existe). Durante uma sessão de suporte
 * a área também some: o token de suporte é recusado pelo backend nas rotas
 * `/platform/*`. Quem decide de verdade é o backend (`require_platform_staff`).
 */
export function PlatformLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to={ROUTES.login} replace />;
  if (user.mustChangePassword) return <Navigate to={ROUTES.forcedPasswordChange} replace />;
  if (!can(user, "platform.console")) {
    if (user.impersonation) {
      return (
        <div style={{ padding: 24 }}>
          <EmptyState
            title="Você está numa sessão de suporte"
            message="Encerre a sessão de suporte (faixa no topo do CRM) para voltar à plataforma."
          />
          <p style={{ textAlign: "center" }}>
            <Link to={ROUTES.dashboard}>Voltar ao CRM do cliente</Link>
          </p>
        </div>
      );
    }
    return (
      <div style={{ padding: 24 }}>
        <NotFoundPage />
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span>&lt;GSM /&gt;</span>
          <span className={styles.brandBadge}>Control Plane</span>
        </div>
        <nav className={styles.nav} aria-label="Plataforma">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.topRight}>
          <span>{user.email}</span>
          <Link to={ROUTES.dashboard} className={styles.backLink}>
            ← Voltar ao CRM
          </Link>
        </div>
      </header>
      <main className={styles.content}>
        {isDemoMode ? (
          <EmptyState
            title="Indisponível na demonstração"
            message="O painel da plataforma só funciona com a API real."
          />
        ) : (
          <ErrorBoundary scope="page">
            <Outlet />
          </ErrorBoundary>
        )}
      </main>
      <ToastHost />
    </div>
  );
}
