import { Link } from "react-router-dom";
import { usePlatformOverview } from "../hooks/usePlatform";
import { EmptyState } from "../components/common/EmptyState";
import { ROUTES } from "../constants/routes";
import styles from "./Platform.module.css";

export function PlatformOverviewPage() {
  const { data, loading, error, reload } = usePlatformOverview();
  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Visão geral da plataforma</h1>
          <p className={styles.subtitle}>Organizações, sessões de suporte e saúde do control plane</p>
        </div>
        <Link to={ROUTES.platformOrganizationNew} className={styles.backLink} style={{ color: "inherit" }}>
          + Nova organização
        </Link>
      </div>

      {error && (
        <EmptyState
          title="Não foi possível carregar"
          message={error.message}
          action={{ label: "Tentar de novo", onClick: reload }}
        />
      )}
      {loading && !data && <p className={styles.muted}>Carregando…</p>}
      {data && (
        <>
          {!data.platformInternalConfigured && (
            <div className={`${styles.notice} ${styles.danger}`} role="alert">
              O tenant interno da GSM não está configurado: SDR, Prospecção e Clientes GSM
              respondem 503 até alguém rodar <code>gsm set-platform-internal-tenant &lt;slug&gt;</code>.
            </div>
          )}
          <div className={styles.cards}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Organizações ativas</div>
              <div className={styles.cardValue}>{data.organizationsActive}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Suspensas</div>
              <div className={styles.cardValue}>{data.organizationsSuspended}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Tenants</div>
              <div className={styles.cardValue}>{data.tenantsTotal}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Suportes abertos agora</div>
              <div className={styles.cardValue}>{data.openImpersonations}</div>
              <Link to={ROUTES.platformSessions} className={styles.muted}>
                ver sessões
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
