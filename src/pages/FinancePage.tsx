import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { SkeletonRows } from "../components/common/Skeleton";
import { CardsView } from "../components/finance/CardsView";
import { CategoriesView } from "../components/finance/CategoriesView";
import { EntriesView } from "../components/finance/EntriesView";
import { EntryFormModal } from "../components/finance/EntryFormModal";
import { FinanceDashboardView } from "../components/finance/FinanceDashboardView";
import {
  useFinanceAccounts,
  useFinanceCards,
  useFinanceCategories,
  useFinanceDashboard,
} from "../hooks/useFinance";
import { usePageTitle } from "../hooks/usePageTitle";
import type { FinScope } from "../types/finance";
import { currentMonth, monthTitle, shiftMonth } from "../utils/finance";
import styles from "../components/finance/Finance.module.css";

type Tab = "painel" | "lancamentos" | "cartoes" | "categorias";
const TABS: [Tab, string][] = [
  ["painel", "Painel"],
  ["lancamentos", "Lançamentos"],
  ["cartoes", "Cartões"],
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
  const [scope, setScope] = useState<FinScope | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [cardForPurchase, setCardForPurchase] = useState<string | undefined>(undefined);
  const [version, setVersion] = useState(0);

  const dashboard = useFinanceDashboard(month, scope);
  const categories = useFinanceCategories();
  const accounts = useFinanceAccounts();
  const cards = useFinanceCards();

  function changed() {
    dashboard.reload();
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
            Uso interno da GSM — receitas, despesas e orçamento, com PF e PJ separados.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Novo lançamento
        </Button>
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

      {tab !== "categorias" && (
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
          <div className={styles.seg} role="group" aria-label="Filtrar por PF ou PJ">
            {([undefined, "pj", "pf"] as const).map((value) => (
              <button
                key={value ?? "all"}
                type="button"
                aria-pressed={scope === value}
                className={scope === value ? `${styles.segBtn} ${styles.segActive}` : styles.segBtn}
                onClick={() => setScope(value)}
              >
                {value === undefined ? "Tudo" : value.toUpperCase()}
              </button>
            ))}
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
                cards={(cards.data ?? []).filter((c) => !scope || c.account.scope === scope)}
                onNewEntry={() => setCreating(true)}
              />
            )}
          </>
        )}

        {tab === "lancamentos" && (
          <EntriesView
            categories={catList}
            accounts={accList}
            scope={scope}
            month={month}
            refreshToken={version}
            onChanged={changed}
          />
        )}

        {tab === "cartoes" && (
          <CardsView
            scope={scope}
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
          defaults={{ ...(scope ? { scope } : {}), ...(cardForPurchase ? { accountId: cardForPurchase } : {}) }}
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
