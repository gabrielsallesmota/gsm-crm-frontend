import { useId, useState } from "react";
import type { AccountKind, CategoryScope, EntryKind, FinAccount, FinCategory, FinScope } from "../../types/finance";
import { ACCOUNT_KIND_LABEL, CATEGORY_SCOPE_LABEL, KIND_LABEL, SCOPE_SHORT } from "../../types/finance";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { formatCents } from "../../utils/finance";
import styles from "./Finance.module.css";

/** Categorias (com orçamento mensal opcional) e contas/cartões — separadas em PF e PJ. */
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
  const [editingBudget, setEditingBudget] = useState<{ id: string; value: number } | null>(null);

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

  async function patch(id: string, body: Parameters<typeof financeService.updateCategory>[1], message: string) {
    try {
      await financeService.updateCategory(id, body);
      toast(message);
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível atualizar a categoria");
    }
  }

  const groups: [EntryKind, FinCategory[]][] = [
    ["expense", categories.filter((c) => c.kind === "expense")],
    ["income", categories.filter((c) => c.kind === "income")],
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
                    {c.kind === "expense" &&
                      (editingBudget?.id === c.id ? (
                        <>
                          <CurrencyInput
                            className={styles.control}
                            aria-label={`Orçamento de ${c.name}`}
                            value={editingBudget.value}
                            onChange={(v) => setEditingBudget({ id: c.id, value: v })}
                          />
                          <Button
                            variant="primary"
                            onClick={() => {
                              void patch(
                                c.id,
                                { monthlyBudgetCents: editingBudget.value > 0 ? Math.round(editingBudget.value * 100) : null },
                                "Orçamento atualizado",
                              );
                              setEditingBudget(null);
                            }}
                          >
                            Salvar
                          </Button>
                          <Button onClick={() => setEditingBudget(null)}>Cancelar</Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => setEditingBudget({ id: c.id, value: (c.monthlyBudgetCents ?? 0) / 100 })}
                          aria-label={`Definir orçamento de ${c.name}`}
                        >
                          Orçamento
                        </Button>
                      ))}
                    <Button
                      onClick={() => void patch(c.id, { archived: true }, "Categoria arquivada")}
                      aria-label={`Arquivar ${c.name}`}
                    >
                      Arquivar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <p className={styles.budgetNote}>
        Arquivar esconde a categoria dos formulários sem apagar o histórico dos lançamentos.
      </p>
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

  async function archive(id: string) {
    try {
      await financeService.updateAccount(id, { archived: true });
      toast("Conta arquivada");
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível arquivar a conta");
    }
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
      {accounts.length === 0 ? (
        <p className={styles.empty}>Nenhuma conta ainda. Contas separam o que é da empresa e o que é pessoal.</p>
      ) : (
        <ul className={styles.list}>
          {accounts.map((a) => (
            <li key={a.id} className={styles.listItem}>
              <span>
                {a.name}{" "}
                <Badge label={SCOPE_SHORT[a.scope]} color="var(--tone-blue-text)" bg="var(--tone-blue-bg)" />
                <span className={styles.listMeta}>
                  {" "}· {ACCOUNT_KIND_LABEL[a.kind]}
                  {a.kind === "cartao" && a.closingDay ? ` · fecha dia ${a.closingDay}, vence dia ${a.dueDay}` : ""}
                </span>
              </span>
              <Button onClick={() => void archive(a.id)} aria-label={`Arquivar ${a.name}`}>
                Arquivar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.budgetNote}>{KIND_LABEL.income}s e {KIND_LABEL.expense.toLowerCase()}s herdam o PF/PJ da conta escolhida.</p>
    </section>
  );
}
