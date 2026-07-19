import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
import { Avatar } from "../components/common/Avatar";
import { NavIcon } from "../components/common/NavIcon";
import { ToastHost } from "../components/common/ToastHost";
import { isDemoMode } from "../services/factory";
import styles from "./AppLayout.module.css";

const NAV_ITEMS: { to: string; icon: Parameters<typeof NavIcon>[0]["name"]; label: string; adminOnly?: boolean }[] = [
  { to: ROUTES.dashboard, icon: "dashboard", label: "Dashboard" },
  { to: ROUTES.pipeline, icon: "pipeline", label: "Pipeline" },
  { to: ROUTES.leads, icon: "leads", label: "Leads" },
  { to: ROUTES.tarefas, icon: "tasks", label: "Tarefas" },
  { to: ROUTES.agenda, icon: "agenda", label: "Agenda" },
  { to: ROUTES.relatorios, icon: "reports", label: "Relatórios" },
  { to: ROUTES.configuracoes, icon: "settings", label: "Configurações", adminOnly: true },
  { to: ROUTES.usuarios, icon: "users", label: "Usuários", adminOnly: true },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, tenants, currentTenant, canSwitchTenant, switchTenant, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin" || user?.role === "gsm_admin";

  async function handleLogout() {
    await logout();
    navigate(ROUTES.login);
  }

  return (
    <div className={styles.shell}>
      {isDemoMode && (
        <div className={styles.demoBanner}>
          <span>
            <b>● DEMONSTRAÇÃO</b> — dados fictícios, sem conexão com banco real.
          </span>
        </div>
      )}

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>
              &lt;GSM <span className={styles.logoAccent}>/&gt;</span>
            </span>
            <span className={styles.logoSub}>CRM</span>
          </div>

          <nav className={styles.nav}>
            {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem)}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className={styles.userBox}>
            {user && <Avatar name={user.name} bg="rgba(46,230,110,.14)" color="#2ee66e" />}
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.name}</div>
              <div className={styles.userRole}>{user?.role === "gsm_admin" ? "admin gsm" : user?.role}</div>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout} title="Sair" aria-label="Sair">
              ⏻
            </button>
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <input className={styles.search} placeholder="Buscar leads, empresas…" />
            <div className={styles.topbarRight}>
              {canSwitchTenant ? (
                <select
                  className={styles.tenantSwitch}
                  value={currentTenant?.id}
                  onChange={(e) => switchTenant(e.target.value)}
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                currentTenant && (
                  <span className={styles.tenantChip}>
                    <Avatar name={currentTenant.name} bg={currentTenant.avatarBg} color={currentTenant.avatarColor} size={22} />
                    {currentTenant.name}
                  </span>
                )
              )}
              <button className={styles.newLeadBtn} onClick={() => navigate(ROUTES.leads)}>
                + Lead
              </button>
            </div>
          </header>

          <main className={styles.content}>{children}</main>
        </div>
      </div>

      <ToastHost />
    </div>
  );
}
