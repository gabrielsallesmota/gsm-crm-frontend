import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { SkeletonRows } from "../components/common/Skeleton";
import { AccountsView } from "../components/finance/AccountsView";
import { CardsView } from "../components/finance/CardsView";
import { CategoriesView } from "../components/finance/CategoriesView";
import { EntriesView } from "../components/finance/EntriesView";
import { EntryFormModal } from "../components/finance/EntryFormModal";
import { ImportView } from "../components/finance/ImportView";
import { ReportsView } from "../components/finance/ReportsView";
import { PlanningView } from "../components/finance/PlanningView";
import { FinanceDashboardView } from "../components/finance/FinanceDashboardView";
import {
  useFinanceAccounts,
  useFinanceCards,
  useFinanceCategories,
  useFinanceDashboard,
  useFinanceOverview,
  useFinanceProfiles,
} from "../hooks/useFinance";
import { usePageTitle } from "../hooks/usePageTitle";
import { currentMonth, monthTitle, shiftMonth } from "../utils/finance";
import styles from "../components/finance/Finance.module.css";

type Tab = "painel" | "lancamentos" | "contas" | "cartoes" | "planejamento" | "importar" | "relatorios" | "categorias";
const TABS: [Tab, string][] = [
  ["painel", "Painel"],
  ["lancamentos", "Lançamentos"],
  ["contas", "Contas"],
  ["cartoes", "Cartões"],
  ["planejamento", "Planejamento"],
  ["importar", "Importar"],
  ["relatorios", "Relatórios"],
  ["categorias", "Categorias e contas"],
];

/**
 * Financeiro da GSM — área INTERNA (só platform staff), nunca de cliente. Painel do mês, lançamentos
 * e categorias, sempre com a separação PF × PJ. A aba ativa vive em `?aba=` (link compartilhável).
 */
export function FinancePage() {
  usePageTitle("Financeiro");
  const [params, setParams] = useSearchParams();
  const requested = params.get("aba");
  const tab: Tab = TABS.some(([id]) => id === requested) ? (requested as Tab) : "painel";
  const [month, setMonth] = useState(currentMonth());
  // Perfil escolhido no topo; vazio = consolidado. Vale para TODAS as abas.
  const [profileId, setProfileId] = useState<string | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [cardForPurchase, setCardForPurchase] = useState<string | undefined>(undefined);
  const [version, setVersion] = useState(0);

  const profiles = useFinanceProfiles();
  const profileList = profiles.data ?? [];
  const activeProfiles = profileList.filter((p) => !p.archived);
  const dashboard = useFinanceDashboard(month, profileId);
  const overview = useFinanceOverview(month, profileId);
  // Com as arquivadas: os formulários as ignoram sozinhos e a aba de cadastro permite desarquivar.
  const categories = useFinanceCategories(true);
  const accounts = useFinanceAccounts(true);
  const cards = useFinanceCards();

  function changed() {
    dashboard.reload();
    overview.reload();
  }

  function selectTab(next: Tab) {
    setParams(next === "painel" ? {} : { aba: next }, { replace: false });
  }

  const catList = categories.data ?? [];
  const accList = accounts.data ?? [];

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Financeiro</h1>
          <p className={styles.subtitle}>
            Uso interno da GSM — receitas, despesas e orçamento por perfil (PF, PJ e outros).
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Novo lançamento
        </Button>
      </div>

      <div className={styles.seg} role="group" aria-label="Perfil" style={{ marginBottom: 12 }}>
        {[{ id: undefined, name: "Consolidado" }, ...activeProfiles].map((p) => (
          <button
            key={p.id ?? "all"}
            type="button"
            aria-pressed={profileId === p.id}
            className={profileId === p.id ? `${styles.segBtn} ${styles.segActive}` : styles.segBtn}
            onClick={() => setProfileId(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Seções do financeiro">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`fin-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="fin-panel"
            className={tab === id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => selectTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "categorias" && tab !== "contas" && tab !== "planejamento" && tab !== "importar" && tab !== "relatorios" && (
        <div className={styles.toolbar}>
          <div className={styles.monthNav}>
            <button type="button" className={styles.iconBtn} aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
              ‹
            </button>
            <span className={styles.monthTitle} aria-live="polite">{monthTitle(month)}</span>
            <button type="button" className={styles.iconBtn} aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>
              ›
            </button>
            {month !== currentMonth() && <Button onClick={() => setMonth(currentMonth())}>Hoje</Button>}
          </div>
        </div>
      )}

      <div id="fin-panel" role="tabpanel" aria-labelledby={`fin-tab-${tab}`}>
        {tab === "painel" && (
          <>
            {dashboard.error && (
              <EmptyState
                title="Não foi possível carregar o painel"
                message={dashboard.error.message}
                actions={[{ label: "Tentar de novo", onClick: dashboard.reload }]}
              />
            )}
            {!dashboard.error && !dashboard.data && <SkeletonRows rows={4} label="Carregando o painel" />}
            {dashboard.data && (
              <FinanceDashboardView
                data={dashboard.data}
                cards={(cards.data ?? []).filter((c) => !profileId || c.account.profileId === profileId)}
                showSplit={!profileId}
                overview={overview.data ?? undefined}
                onNewEntry={() => setCreating(true)}
              />
            )}
          </>
        )}

        {tab === "lancamentos" && (
          <EntriesView
            categories={catList}
            accounts={accList}
            profiles={profileList}
            profileId={profileId}
            month={month}
            refreshToken={version}
            onChanged={changed}
          />
        )}

        {tab === "contas" && (
          <AccountsView
            accounts={accList}
            profiles={profileList}
            profileId={profileId}
            onChanged={() => {
              accounts.reload();
              dashboard.reload();
            }}
          />
        )}

        {tab === "planejamento" && (
          <PlanningView
            profiles={profileList}
            profileId={profileId}
            accounts={accList}
            month={month}
            onChanged={() => {
              dashboard.reload();
              setVersion((v) => v + 1);
            }}
          />
        )}

        {tab === "relatorios" && (
          <ReportsView profiles={profileList} profileId={profileId} accounts={accList} />
        )}

        {tab === "importar" && (
          <ImportView
            accounts={accList}
            categories={catList}
            profiles={profileList}
            profileId={profileId}
            onChanged={() => {
              accounts.reload();
              dashboard.reload();
              setVersion((v) => v + 1);
            }}
          />
        )}

        {tab === "cartoes" && (
          <CardsView
            profiles={profileList}
            profileId={profileId}
            refreshToken={version}
            onChanged={() => {
              accounts.reload();
              dashboard.reload();
            }}
            onNewPurchase={(accountId) => {
              setCardForPurchase(accountId);
              setCreating(true);
            }}
          />
        )}

        {tab === "categorias" && (
          <CategoriesView
            categories={catList}
            accounts={accList}
            profiles={profileList}
            profileId={profileId}
            onProfilesChanged={() => {
              profiles.reload();
              categories.reload();
              accounts.reload();
              dashboard.reload();
            }}
            onChanged={() => {
              categories.reload();
              accounts.reload();
              dashboard.reload();
            }}
          />
        )}
      </div>

      {creating && (
        <EntryFormModal
          entry={null}
          categories={catList}
          accounts={accList}
          profiles={profileList}
          defaults={{ ...(profileId ? { profileId } : {}), ...(cardForPurchase ? { accountId: cardForPurchase } : {}) }}
          onClose={() => {
            setCreating(false);
            setCardForPurchase(undefined);
          }}
          onSaved={() => {
            dashboard.reload();
            accounts.reload();
            cards.reload();
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
