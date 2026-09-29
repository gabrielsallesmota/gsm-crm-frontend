import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
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
import { roleLabel as labelForRole } from "../auth/permissions";
import { navSections } from "./navigation";
import { DEFAULT_BRAND } from "../config/brand";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { SupportBanner } from "../components/common/SupportBanner";
import styles from "./AppLayout.module.css";

function roleLabel(user: AuthUser | null): string | undefined {
  return user ? labelForRole(user.role) : undefined;
}

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
  const online = useOnlineStatus();
  const [query, setQuery] = useState("");

  // Busca global (Etapa 4): Enter leva para Leads já filtrado.
  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const term = query.trim();
    navigate(term ? `${ROUTES.leads}?busca=${encodeURIComponent(term)}` : ROUTES.leads);
  }

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
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      {isDemoMode && (
        <div className={`${styles.demoBanner} theme-dark`}>
          <span>
            <b>● DEMONSTRAÇÃO</b> — dados fictícios, sem conexão com banco real.
          </span>
        </div>
      )}

      <SupportBanner />
      {!online && (
        <div className={styles.offlineBanner} role="status">
          Você está sem conexão. O que estiver na tela continua visível, mas nada será salvo até a
          internet voltar.
        </div>
      )}

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
                  &lt;{DEFAULT_BRAND.logoMark} <span className={styles.logoAccent}>/&gt;</span>
                </span>
                <span className={styles.logoSub}>{DEFAULT_BRAND.logoSuffix}</span>
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

          <nav className={styles.nav} aria-label="Menu principal">
            {navSections(user).map((section) => (
              <div key={section.id} className={styles.navSection}>
                {section.title && (
                  <div className={styles.navSectionTitle} aria-hidden={collapsed}>
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => (
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
                ))}
              </div>
            ))}
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
            <Link to={ROUTES.perfil} className={styles.userLink} title="Meu perfil">
              {user && (
                <Avatar name={user.name} bg="var(--tone-green-bg)" color="var(--tone-green)" />
              )}
              <div className={styles.userInfo}>
                <div className={styles.userName}>{user?.name}</div>
                <div className={styles.userRole}>{roleLabel(user)} · Meu perfil</div>
              </div>
            </Link>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={() => void handleLogout()}
              title="Sair"
              aria-label="Sair da conta"
            >
              <span aria-hidden="true">⏻</span>
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
            <form role="search" className={styles.searchForm} onSubmit={handleSearch}>
              <label htmlFor="busca-global" className="sr-only">
                Buscar leads
              </label>
              <input
                id="busca-global"
                type="search"
                className={styles.search}
                placeholder="Buscar leads, empresas, telefone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                enterKeyHint="search"
              />
            </form>
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
                  aria-label="Organização"
                  value={user?.tenantId}
                  onChange={(e) => {
                    const tenantId = e.target.value;
                    selectTenant(tenantId).catch((err: unknown) => {
                      toastError(err, "Não foi possível trocar de organização.");
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
              <button
                type="button"
                className={styles.newLeadBtn}
                onClick={() => navigate(`${ROUTES.leads}?novo=1`)}
                aria-label="Novo lead"
              >
                + Lead
              </button>
            </div>
          </header>

          <main id="conteudo" className={styles.content} tabIndex={-1}>
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
