import { useId, useState } from "react";
import type { AccountKind, CategoryScope, EntryKind, FinAccount, FinCategory, FinScope } from "../../types/finance";
import { ACCOUNT_KIND_LABEL, CATEGORY_SCOPE_LABEL, SCOPE_SHORT } from "../../types/finance";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { AccountEditModal, CategoryEditModal } from "./EditModals";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { formatCents } from "../../utils/finance";
import styles from "./Finance.module.css";

/**
 * Categorias (com orçamento mensal opcional) e contas/cartões, separadas em PF e PJ. Tudo pode ser
 * editado; arquivar esconde dos formulários sem apagar o histórico, e dá para desarquivar.
 * `categories` e `accounts` chegam COM as arquivadas.
 */
export function CategoriesView({
  categories,
  accounts,
  onChanged,
}: {
  categories: FinCategory[];
  accounts: FinAccount[];
  onChanged: () => void;
}) {
  return (
    <div>
      <CategoriesSection categories={categories} onChanged={onChanged} />
      <AccountsSection accounts={accounts} onChanged={onChanged} />
    </div>
  );
}

function CategoriesSection({ categories, onChanged }: { categories: FinCategory[]; onChanged: () => void }) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EntryKind>("expense");
  const [scope, setScope] = useState<CategoryScope>("both");
  const [color, setColor] = useState("#4aa3ff");
  const [budget, setBudget] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<FinCategory | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await financeService.createCategory({
        name: name.trim(),
        kind,
        scope,
        color,
        monthlyBudgetCents: kind === "expense" && budget > 0 ? Math.round(budget * 100) : null,
      });
      setName("");
      setBudget(0);
      toast("Categoria criada");
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível criar a categoria");
    } finally {
      setBusy(false);
    }
  }

  async function setArchived(c: FinCategory, archived: boolean) {
    try {
      await financeService.updateCategory(c.id, { archived });
      toast(archived ? "Categoria arquivada" : "Categoria reativada");
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível atualizar a categoria");
    }
  }

  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  const groups: [EntryKind, FinCategory[]][] = [
    ["expense", active.filter((c) => c.kind === "expense")],
    ["income", active.filter((c) => c.kind === "income")],
  ];

  return (
    <section className={styles.card} aria-labelledby={`${uid}-cats`}>
      <h3 id={`${uid}-cats`} className={styles.cardTitle}>Categorias</h3>
      <div className={styles.inlineForm}>
        <label className={styles.filterField}>
          Nome
          <input className={styles.control} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.filterField}>
          Tipo
          <select className={styles.control} value={kind} onChange={(e) => setKind(e.target.value as EntryKind)}>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </label>
        <label className={styles.filterField}>
          Vale para
          <select className={styles.control} value={scope} onChange={(e) => setScope(e.target.value as CategoryScope)}>
            <option value="both">PF e PJ</option>
            <option value="pj">Só PJ</option>
            <option value="pf">Só PF</option>
          </select>
        </label>
        {kind === "expense" && (
          <label className={styles.filterField}>
            Orçamento mensal
            <CurrencyInput className={styles.control} value={budget} onChange={setBudget} />
          </label>
        )}
        <label className={styles.filterField}>
          Cor
          <input className={styles.swatch} type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <Button variant="primary" onClick={() => void create()} disabled={busy || !name.trim()}>
          Adicionar
        </Button>
      </div>

      {groups.map(([groupKind, items]) => (
        <div key={groupKind} className={styles.sectionGap}>
          <h4 className={styles.cardTitle}>{groupKind === "expense" ? "Despesas" : "Receitas"}</h4>
          {items.length === 0 ? (
            <p className={styles.empty}>Nenhuma categoria.</p>
          ) : (
            <ul className={styles.list}>
              {items.map((c) => (
                <li key={c.id} className={styles.listItem}>
                  <span className={styles.listMain}>
                    <span className={styles.dot} style={{ background: c.color }} aria-hidden="true" />
                    {c.name}{" "}
                    <Badge label={CATEGORY_SCOPE_LABEL[c.scope]} color="var(--tone-blue-text)" bg="var(--tone-blue-bg)" />
                    {c.monthlyBudgetCents !== null && (
                      <span className={styles.listMeta}> · orçamento {formatCents(c.monthlyBudgetCents)}/mês</span>
                    )}
                  </span>
                  <span className={styles.rowActions}>
                    <Button onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`}>Editar</Button>
                    <Button onClick={() => void setArchived(c, true)} aria-label={`Arquivar ${c.name}`}>Arquivar</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {archived.length > 0 && (
        <div className={styles.sectionGap}>
          <Button onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            {showArchived ? "Ocultar arquivadas" : `Arquivadas (${archived.length})`}
          </Button>
          {showArchived && (
            <ul className={styles.list} style={{ marginTop: 10 }} aria-label="Categorias arquivadas">
              {archived.map((c) => (
                <li key={c.id} className={styles.listItem}>
                  <span className={styles.listMain}>
                    <span className={styles.dot} style={{ background: c.color }} aria-hidden="true" />
                    {c.name} <span className={styles.listMeta}>· {c.kind === "income" ? "receita" : "despesa"}</span>
                  </span>
                  <span className={styles.rowActions}>
                    <Button onClick={() => void setArchived(c, false)} aria-label={`Desarquivar ${c.name}`}>
                      Desarquivar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className={styles.budgetNote}>
        Arquivar esconde a categoria dos formulários sem apagar o histórico dos lançamentos.
      </p>

      {editing && (
        <CategoryEditModal category={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
      )}
    </section>
  );
}

function AccountsSection({ accounts, onChanged }: { accounts: FinAccount[]; onChanged: () => void }) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<FinScope>("pj");
  const [kind, setKind] = useState<AccountKind>("conta");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<FinAccount | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await financeService.createAccount({ name: name.trim(), scope, kind });
      setName("");
      toast("Conta criada");
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível criar a conta");
    } finally {
      setBusy(false);
    }
  }

  async function setArchived(a: FinAccount, archived: boolean) {
    try {
      await financeService.updateAccount(a.id, { archived });
      toast(archived ? "Conta arquivada" : "Conta reativada");
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível atualizar a conta");
    }
  }

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  function line(a: FinAccount) {
    return (
      <span className={styles.listMain}>
        {a.name} <Badge label={SCOPE_SHORT[a.scope]} color="var(--tone-blue-text)" bg="var(--tone-blue-bg)" />
        <span className={styles.listMeta}>
          {" "}· {ACCOUNT_KIND_LABEL[a.kind]}
          {a.kind === "cartao" && a.closingDay ? ` · fecha dia ${a.closingDay}, vence dia ${a.dueDay}` : ""}
        </span>
      </span>
    );
  }

  return (
    <section className={`${styles.card} ${styles.sectionGap}`} aria-labelledby={`${uid}-accs`}>
      <h3 id={`${uid}-accs`} className={styles.cardTitle}>Contas e cartões</h3>
      <div className={styles.inlineForm}>
        <label className={styles.filterField}>
          Nome
          <input className={styles.control} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank PJ" />
        </label>
        <label className={styles.filterField}>
          De quem
          <select className={styles.control} value={scope} onChange={(e) => setScope(e.target.value as FinScope)}>
            <option value="pj">PJ</option>
            <option value="pf">PF</option>
          </select>
        </label>
        <label className={styles.filterField}>
          Tipo
          <select className={styles.control} value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
            {(Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[])
              .filter((k) => k !== "cartao") /* cartão de crédito tem aba própria */
              .map((k) => (
                <option key={k} value={k}>{ACCOUNT_KIND_LABEL[k]}</option>
              ))}
          </select>
        </label>
        <Button variant="primary" onClick={() => void create()} disabled={busy || !name.trim()}>
          Adicionar
        </Button>
      </div>
      {active.length === 0 ? (
        <p className={styles.empty}>Nenhuma conta ainda. Contas separam o que é da empresa e o que é pessoal.</p>
      ) : (
        <ul className={styles.list}>
          {active.map((a) => (
            <li key={a.id} className={styles.listItem}>
              {line(a)}
              <span className={styles.rowActions}>
                <Button onClick={() => setEditing(a)} aria-label={`Editar ${a.name}`}>Editar</Button>
                <Button onClick={() => void setArchived(a, true)} aria-label={`Arquivar ${a.name}`}>Arquivar</Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <div className={styles.sectionGap}>
          <Button onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            {showArchived ? "Ocultar arquivadas" : `Arquivadas (${archived.length})`}
          </Button>
          {showArchived && (
            <ul className={styles.list} style={{ marginTop: 10 }} aria-label="Contas arquivadas">
              {archived.map((a) => (
                <li key={a.id} className={styles.listItem}>
                  {line(a)}
                  <span className={styles.rowActions}>
                    <Button onClick={() => void setArchived(a, false)} aria-label={`Desarquivar ${a.name}`}>
                      Desarquivar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && <AccountEditModal account={editing} onClose={() => setEditing(null)} onSaved={onChanged} />}
    </section>
  );
}
