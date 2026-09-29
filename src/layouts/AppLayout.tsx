import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
import { Avatar } from "../components/common/Avatar";
import { NavIcon } from "../components/common/NavIcon";
import { ThemeToggle } from "../components/common/ThemeToggle";
import { ToastHost } from "../components/common/ToastHost";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { useToast } from "../hooks/useToast";
import { isDemoMode } from "../services/factory";
import type { AuthUser } from "../types/auth";
import { can, roleLabel as labelForRole, type Permission } from "../auth/permissions";
import { hasFeature, type TenantFeature } from "../auth/features";
import { SupportBanner } from "../components/common/SupportBanner";
import styles from "./AppLayout.module.css";

function roleLabel(user: AuthUser | null): string | undefined {
  return user ? labelForRole(user.role) : undefined;
}

const NAV_ITEMS: {
  to: string;
  icon: Parameters<typeof NavIcon>[0]["name"];
  label: string;
  /** Mesma permissão exigida pela ROTA (`routes/index.tsx`) — menu e rota
   * nunca divergem. `platform.internal` = área interna da GSM ("Clientes"
   * e SDR); as demais espelham os papéis do backend. Ver
   * `auth/permissions.ts`. */
  permission?: Permission;
  /** Funcionalidade contratada exigida (Etapa 2) — some do menu quando o
   * tenant não contratou (o backend recusa de qualquer jeito). */
  feature?: TenantFeature;
}[] = [
  { to: ROUTES.dashboard, icon: "dashboard", label: "Dashboard", feature: "dashboard" },
  // Prospecção GSM não tem item de menu próprio — para quem é super admin,
  // ela aparece embutida dentro de Pipeline/Dashboard (filtro Ativo/
  // Passivo/Todos), não como uma tela separada. Ver `PipelinePage.tsx`.
  { to: ROUTES.pipeline, icon: "pipeline", label: "Pipeline", feature: "crm" },
  { to: ROUTES.leads, icon: "leads", label: "Leads", feature: "crm" },
  { to: ROUTES.clientes, icon: "clients", label: "Clientes", permission: "platform.internal" },
  // SDR (Etapa 1) — pré-prospecção interna da GSM, mesmo gate de "Clientes"
  // acima. Reaproveita o ícone "prospects" (alvo/crosshair) — hoje sem uso
  // real em NAV_ITEMS (Prospecção GSM fica embutida em Pipeline, ver
  // comentário acima), e "pré-prospecção" é exatamente a ideia de um alvo.
  { to: ROUTES.sdrDashboard, icon: "prospects", label: "SDR", permission: "platform.internal" },
  { to: ROUTES.tarefas, icon: "tasks", label: "Tarefas", feature: "crm" },
  { to: ROUTES.agenda, icon: "agenda", label: "Agenda", feature: "crm" },
  { to: ROUTES.relatorios, icon: "reports", label: "Relatórios", feature: "reports" },
  {
    to: ROUTES.configuracoes,
    icon: "settings",
    label: "Configurações",
    permission: "settings.manage",
  },
  { to: ROUTES.usuarios, icon: "users", label: "Usuários", permission: "users.view" },
  // Control plane — área própria (layout separado); só platform staff e
  // nunca durante uma sessão de suporte.
  {
    to: ROUTES.platform,
    icon: "platform",
    label: "Plataforma GSM",
    permission: "platform.console",
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const {
    user,
    tenants,
    currentTenant,
    canSwitchTenant,
    switchTenant,
    currentTenantName,
    availableTenants,
    selectTenant,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toastError } = useToast();
  // Sidebar em telas estreitas vira drawer off-canvas (ver media query em
  // `AppLayout.module.css`) — controlado só aqui porque em desktop o botão
  // que abre/fecha nem é renderizado (`.menuToggle` some via CSS).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Sidebar fixa (desktop/tablet) recolhida pra uma barra só de ícones —
  // independente do drawer mobile acima, que já resolve o espaço à sua
  // própria maneira (some por completo em vez de encolher). Lido de forma
  // preguiçosa (função no useState) pra não piscar expandida no primeiro
  // paint de quem já deixou recolhida da última vez.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("gsm_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("gsm_sidebar_collapsed", collapsed ? "1" : "0");
    } catch {
      // Storage indisponível (modo privado, quota etc.) — a preferência
      // só não persiste entre sessões, sem quebrar o toggle em si.
    }
  }, [collapsed]);

  // Fecha o drawer sempre que a rota muda (clique num item do menu) —
  // cobre também navegação disparada por outro lugar (ex.: `+ Lead`).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Esc fecha o drawer, igual a qualquer overlay da aplicação.
  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  // Troca de tenant real (produção) — independente do mecanismo de demo
  // (`canSwitchTenant`/`switchTenant`, que continua intocado).
  const canSwitchRealTenant = !isDemoMode && availableTenants.length > 1;

  async function handleLogout() {
    await logout();
    navigate(ROUTES.login);
  }

  return (
    <div className={styles.shell}>
      {isDemoMode && (
        <div className={`${styles.demoBanner} theme-dark`}>
          <span>
            <b>● DEMONSTRAÇÃO</b> — dados fictícios, sem conexão com banco real.
          </span>
        </div>
      )}

      <SupportBanner />

      <div className={styles.body}>
        {mobileNavOpen && (
          <div
            className={styles.navOverlay}
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          id="app-sidebar"
          className={[
            "theme-dark",
            styles.sidebar,
            mobileNavOpen && styles.sidebarOpen,
            collapsed && styles.sidebarCollapsed,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={styles.logo}>
            {collapsed ? (
              <span className={styles.logoMark}>
                &lt;<span className={styles.logoAccent}>/</span>&gt;
              </span>
            ) : (
              <>
                <span className={styles.logoMark}>
                  &lt;GSM <span className={styles.logoAccent}>/&gt;</span>
                </span>
                <span className={styles.logoSub}>CRM</span>
              </>
            )}
            <button
              type="button"
              className={styles.sidebarClose}
              onClick={() => setMobileNavOpen(false)}
              aria-label="Fechar menu"
            >
              <NavIcon name="close" size={16} />
            </button>
          </div>

          <nav className={styles.nav}>
            {NAV_ITEMS.filter(
              (item) =>
                (!item.permission || can(user, item.permission)) &&
                (!item.feature || hasFeature(user, item.feature)),
            ).map(
              (item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  className={({ isActive }) =>
                    isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
                  }
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ),
            )}
          </nav>

          <button
            type="button"
            className={styles.collapseToggle}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <NavIcon name="collapse" size={14} />
            {!collapsed && <span>Recolher menu</span>}
          </button>

          <div className={styles.userBox}>
            {user && (
              <Avatar name={user.name} bg="var(--tone-green-bg)" color="var(--tone-green)" />
            )}
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.name}</div>
              <div className={styles.userRole}>{roleLabel(user)}</div>
            </div>
            <button
              className={styles.logoutBtn}
              onClick={handleLogout}
              title="Sair"
              aria-label="Sair"
            >
              ⏻
            </button>
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <button
              type="button"
              className={styles.menuToggle}
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menu"
              aria-controls="app-sidebar"
              aria-expanded={mobileNavOpen}
            >
              <NavIcon name="menu" size={19} />
            </button>
            <input className={styles.search} placeholder="Buscar leads, empresas…" />
            <div className={styles.topbarRight}>
              {isDemoMode && canSwitchTenant ? (
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
              ) : canSwitchRealTenant ? (
                <select
                  className={styles.tenantSwitch}
                  value={user?.tenantId}
                  onChange={(e) => {
                    const tenantId = e.target.value;
                    selectTenant(tenantId).catch((err: unknown) => {
                      toastError(err, "Não foi possível trocar de tenant.");
                    });
                  }}
                >
                  {availableTenants.map((t) => (
                    <option key={t.tenantId} value={t.tenantId}>
                      {t.tenantName}
                    </option>
                  ))}
                </select>
              ) : (
                currentTenantName && (
                  <span className={styles.tenantChip}>
                    <Avatar
                      name={currentTenantName}
                      bg={currentTenant?.avatarBg ?? "var(--tone-green-bg)"}
                      color={currentTenant?.avatarColor ?? "var(--tone-green)"}
                      size={22}
                    />
                    {currentTenantName}
                  </span>
                )
              )}
              <ThemeToggle />
              <button className={styles.newLeadBtn} onClick={() => navigate(ROUTES.leads)}>
                + Lead
              </button>
            </div>
          </header>

          <main className={styles.content}>
            <ErrorBoundary key={location.pathname} scope="page">
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <ToastHost />
    </div>
  );
}
