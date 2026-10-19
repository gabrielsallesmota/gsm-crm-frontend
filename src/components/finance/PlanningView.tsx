import { useEffect, useId, useState } from "react";
import type {
  FinAccount,
  FinGoal,
  FinProfile,
  FinRecurrence,
  Frequency,
  GoalKind,
} from "../../types/finance";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ValueModal } from "./ValueModal";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { CurrencyInput } from "../common/CurrencyInput";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import { useFinanceBudgets, useFinanceGoals, useFinanceRecurrences } from "../../hooks/useFinance";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { barRatio, budgetTone, formatCents, monthTitle, shiftMonth } from "../../utils/finance";
import { fmtDate } from "../../utils/renewal";
import styles from "./Finance.module.css";
import form from "../common/Form.module.css";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: "Toda semana",
  biweekly: "A cada 15 dias",
  monthly: "Todo mês",
  yearly: "Todo ano",
};

/**
 * Planejamento: recorrências (próxima data, aprovação, encerrar), orçamentos mensais por categoria
 * (copiar mês anterior, sobra opcional) e metas / reserva de emergência.
 */
export function PlanningView({
  profiles,
  profileId,
  accounts,
  month,
  onChanged,
}: {
  profiles: FinProfile[];
  /** Perfil escolhido no topo; sem perfil (consolidado) o orçamento pede para escolher um. */
  profileId: string | undefined;
  accounts: FinAccount[];
  month: string;
  onChanged: () => void;
}) {
  const active = profiles.filter((p) => !p.archived);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const budgetProfile = profileId ?? picked ?? active[0]?.id;

  return (
    <div>
      <RecurrencesSection profiles={profiles} profileId={profileId} onChanged={onChanged} />
      {!profileId && active.length > 1 && (
        <label className={styles.filterField} style={{ marginTop: 14 }}>
          Perfil dos orçamentos e metas
          <select
            className={styles.control}
            value={budgetProfile ?? ""}
            onChange={(e) => setPicked(e.target.value)}
          >
            {active.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}
      <BudgetsSection profileId={budgetProfile} month={month} onChanged={onChanged} />
      <GoalsSection profiles={profiles} profileId={budgetProfile} accounts={accounts} onChanged={onChanged} />
    </div>
  );
}

// --- recorrências -----------------------------------------------------------------------------

function RecurrencesSection({
  profiles,
  profileId,
  onChanged,
}: {
  profiles: FinProfile[];
  profileId: string | undefined;
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const recurrences = useFinanceRecurrences();
  const [queue, setQueue] = useState<{ id: string; description: string; entryDate: string; amountCents: number }[]>([]);
  const [ending, setEnding] = useState<FinRecurrence | null>(null);
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const items = (recurrences.data ?? []).filter((r) => !profileId || r.profileId === profileId);

  function loadQueue() {
    void financeService
      .listEntries({ unconfirmed: true, ...(profileId ? { profileId } : {}), pageSize: 50 })
      .then((page) =>
        setQueue(
          page.items.map((e) => ({
            id: e.id,
            description: e.description,
            entryDate: e.entryDate,
            amountCents: e.amountCents,
          })),
        ),
      )
      .catch((err) => toastError(err, "Não foi possível carregar as aprovações"));
  }
  useEffect(loadQueue, [profileId, recurrences.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(id: string) {
    try {
      await financeService.confirmEntry(id);
      toast("Ocorrência aprovada");
      recurrences.reload();
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível aprovar");
    }
  }

  async function end(): Promise<boolean> {
    if (!ending) return false;
    try {
      await financeService.endRecurrence(ending.id);
      toast("Recorrência encerrada — as futuras sem pagamento foram para a lixeira");
      recurrences.reload();
      onChanged();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível encerrar");
      return false;
    }
  }

  return (
    <section className={styles.card} aria-labelledby={`${uid}-rec`}>
      <h3 id={`${uid}-rec`} className={styles.cardTitle}>Recorrências</h3>
      {recurrences.error && (
        <EmptyState
          title="Não foi possível carregar as recorrências"
          message={recurrences.error.message}
          actions={[{ label: "Tentar de novo", onClick: recurrences.reload }]}
        />
      )}
      {!recurrences.error && !recurrences.data && <SkeletonRows rows={2} label="Carregando as recorrências" />}
      {recurrences.data && items.length === 0 && (
        <p className={styles.empty}>
          Nenhuma recorrência. Crie um lançamento com “Recorrente” para aluguel, assinaturas, salário…
        </p>
      )}
      {items.length > 0 && (
        <ul className={styles.list} aria-label="Recorrências ativas">
          {items.map((r) => (
            <li key={r.id} className={styles.listItem}>
              <span className={styles.listMain}>
                {r.description}{" "}
                <Badge label={r.kind === "income" ? "Receita" : "Despesa"} color="var(--tone-blue-text)" bg="var(--tone-blue-bg)" />
                <span className={styles.listMeta}>
                  {" "}· {FREQUENCY_LABEL[r.frequency]} · {r.mode === "manual" ? "com aprovação" : "automática"} ·{" "}
                  {names.get(r.profileId) ?? "—"}
                  {r.nextDate ? ` · próxima ${fmtDate(r.nextDate)}` : ""}
                  {r.endDate ? ` · até ${fmtDate(r.endDate)}` : " · sem fim"}
                  {r.pendingApprovals > 0 ? ` · ${r.pendingApprovals} aguardando aprovação` : ""}
                </span>
              </span>
              <span className={styles.rowActions}>
                <strong>{formatCents(r.amountCents)}</strong>
                <Button onClick={() => setEnding(r)} aria-label={`Encerrar recorrência ${r.description}`}>
                  Encerrar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {queue.length > 0 && (
        <div className={styles.sectionGap}>
          <h4 className={styles.cardTitle}>Aguardando aprovação</h4>
          <ul className={styles.list} aria-label="Aguardando aprovação">
            {queue.map((e) => (
              <li key={e.id} className={styles.listItem}>
                <span className={styles.listMain}>
                  {e.description} <span className={styles.listMeta}>· {fmtDate(e.entryDate)}</span>
                </span>
                <span className={styles.rowActions}>
                  <strong>{formatCents(e.amountCents)}</strong>
                  <Button onClick={() => void approve(e.id)} aria-label={`Aprovar ${e.description} de ${fmtDate(e.entryDate)}`}>
                    Aprovar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.budgetNote}>Aprovar confirma o lançamento; não dá baixa (pagar é outro passo).</p>
        </div>
      )}

      {ending && (
        <ConfirmDialog
          title="Encerrar a recorrência?"
          message={`“${ending.description}” não gera mais ocorrências. As futuras ainda sem pagamento vão para a lixeira; o que já foi pago continua.`}
          confirmLabel="Encerrar"
          onConfirm={end}
          onClose={() => setEnding(null)}
        />
      )}
    </section>
  );
}

// --- orçamentos -------------------------------------------------------------------------------

function BudgetsSection({
  profileId,
  month: initialMonth,
  onChanged,
}: {
  profileId: string | undefined;
  month: string;
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [month, setMonth] = useState(initialMonth);
  const budgets = useFinanceBudgets(profileId, month);

  async function save(categoryId: string, value: number | null) {
    try {
      await financeService.setBudget(categoryId, month, value);
      budgets.reload();
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível salvar o orçamento");
    }
  }

  async function copyPrevious() {
    if (!profileId) return;
    try {
      const copied = await financeService.copyBudgets(profileId, shiftMonth(month, -1), month);
      toast(
        copied === 0
          ? "Nada para copiar: o mês anterior não tem valores definidos (ou este mês já tem)"
          : `${copied} ${copied === 1 ? "orçamento copiado" : "orçamentos copiados"} do mês anterior`,
      );
      budgets.reload();
    } catch (err) {
      toastError(err, "Não foi possível copiar o mês anterior");
    }
  }

  const lines = budgets.data ?? [];
  return (
    <section className={`${styles.card} ${styles.sectionGap}`} aria-labelledby={`${uid}-bud`}>
      <div className={styles.toolbar} style={{ justifyContent: "space-between" }}>
        <h3 id={`${uid}-bud`} className={styles.cardTitle} style={{ margin: 0 }}>Orçamentos do mês</h3>
        <span className={styles.rowActions}>
          <span className={styles.monthNav}>
            <button type="button" className={styles.iconBtn} aria-label="Orçamento do mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <span className={styles.monthTitle} aria-live="polite">{monthTitle(month)}</span>
            <button type="button" className={styles.iconBtn} aria-label="Orçamento do próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </span>
          <Button onClick={() => void copyPrevious()}>Copiar mês anterior</Button>
        </span>
      </div>
      {budgets.error && (
        <EmptyState
          title="Não foi possível carregar os orçamentos"
          message={budgets.error.message}
          actions={[{ label: "Tentar de novo", onClick: budgets.reload }]}
        />
      )}
      {!budgets.error && !budgets.data && <SkeletonRows rows={3} label="Carregando os orçamentos" />}
      {budgets.data && lines.length === 0 && <p className={styles.empty}>Este perfil não tem categorias de despesa.</p>}
      {lines.length > 0 && (
        <div className={styles.tableWrap} role="region" aria-label="Orçamento do mês" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Categoria</th>
                <th className={styles.num}>Orçamento</th>
                <th className={styles.num}>Gasto</th>
                <th className={styles.num}>Disponível</th>
                <th>Uso</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const tone = budgetTone(l.usedRatio);
                return (
                  <tr key={l.categoryId}>
                    <td>
                      <span className={styles.dot} style={{ background: l.color }} aria-hidden="true" /> {l.name}
                      {l.rollover && <span className={styles.listMeta}> · sobra passa adiante</span>}
                    </td>
                    <td className={styles.num}>
                      <BudgetInput
                        label={`Orçamento de ${l.name}`}
                        cents={l.budgetCents}
                        source={l.source}
                        onSave={(v) => save(l.categoryId, v)}
                      />
                    </td>
                    <td className={styles.num}>{formatCents(l.spentCents)}</td>
                    <td className={styles.num}>
                      {l.availableCents === null ? "—" : formatCents(l.availableCents)}
                      {l.carryCents > 0 && (
                        <span className={styles.listMeta}> (+{formatCents(l.carryCents)} da sobra)</span>
                      )}
                    </td>
                    <td>
                      {l.usedRatio === null ? (
                        "—"
                      ) : (
                        <span
                          role="img"
                          aria-label={`${Math.round(l.usedRatio * 100)}% usado`}
                          className={tone === "over" ? styles.budgetOver : tone === "warn" ? styles.budgetWarn : undefined}
                        >
                          {Math.round(l.usedRatio * 100)}%
                          <span className={styles.track} style={{ display: "block" }}>
                            <span
                              className={styles.fill}
                              style={{
                                display: "block",
                                width: `${barRatio(l.spentCents, l.availableCents ?? 1) * 100}%`,
                                background: tone === "over" ? "var(--tone-red)" : tone === "warn" ? "var(--tone-amber)" : "var(--tone-blue)",
                              }}
                            />
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.budgetNote}>
        “Padrão” é o orçamento fixo da categoria; defina um valor para o mês e ele vence o padrão. Esvazie o campo para
        voltar ao padrão. A sobra só passa ao mês seguinte nas categorias com essa opção ligada.
      </p>
    </section>
  );
}

function BudgetInput({
  label,
  cents,
  source,
  onSave,
}: {
  label: string;
  cents: number | null;
  source: "month" | "default" | "none";
  onSave: (value: number | null) => void;
}) {
  const [value, setValue] = useState((cents ?? 0) / 100);
  useEffect(() => setValue((cents ?? 0) / 100), [cents]);
  return (
    <span>
      <CurrencyInput
        aria-label={label}
        className={styles.control}
        value={value}
        onChange={setValue}
        onBlur={() => {
          const next = Math.round(value * 100);
          if (next === (cents ?? 0) && source !== "default") return;
          if (next === 0 && source === "month") onSave(null);
          else if (next !== (cents ?? 0)) onSave(next);
        }}
      />
      {source === "default" && <span className={styles.listMeta}> padrão</span>}
    </span>
  );
}

// --- metas e reserva de emergência ----------------------------------------------------------------

function GoalsSection({
  profiles,
  profileId,
  accounts,
  onChanged,
}: {
  profiles: FinProfile[];
  profileId: string | undefined;
  accounts: FinAccount[];
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const goals = useFinanceGoals(profileId);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GoalKind>("goal");
  const [target, setTarget] = useState(0);
  const [months, setMonths] = useState(6);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState<{ goal: FinGoal; sign: 1 | -1 } | null>(null);
  const profileName = profiles.find((p) => p.id === profileId)?.name;
  const eligible = accounts.filter((a) => a.kind !== "cartao" && !a.archived && a.profileId === profileId);

  async function create() {
    if (!profileId) return;
    setBusy(true);
    try {
      await financeService.createGoal({
        profileId,
        name: name.trim(),
        kind,
        ...(kind === "goal" ? { targetCents: Math.round(target * 100) } : { targetMonths: months }),
        ...(accountId ? { accountId } : {}),
      });
      setName("");
      setTarget(0);
      toast(kind === "goal" ? "Meta criada" : "Reserva de emergência criada");
      goals.reload();
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível criar a meta");
    } finally {
      setBusy(false);
    }
  }

  async function contribute(goal: FinGoal, sign: 1 | -1, value: number | null) {
    if (value === null || value <= 0) return;
    try {
      await financeService.contributeGoal(goal.id, sign * Math.round(value * 100));
      goals.reload();
    } catch (err) {
      toastError(err, "Não foi possível atualizar a meta");
    }
  }

  async function archive(goal: FinGoal) {
    try {
      await financeService.updateGoal(goal.id, { archived: true });
      toast("Meta arquivada");
      goals.reload();
    } catch (err) {
      toastError(err, "Não foi possível arquivar a meta");
    }
  }

  const items = goals.data ?? [];
  return (
    <section className={`${styles.card} ${styles.sectionGap}`} aria-labelledby={`${uid}-goals`}>
      <h3 id={`${uid}-goals`} className={styles.cardTitle}>Metas e reserva de emergência{profileName ? ` — ${profileName}` : ""}</h3>
      {profileId && (
        <div className={styles.inlineForm}>
          <label className={styles.filterField}>
            Nome
            <input className={styles.control} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={styles.filterField}>
            Tipo
            <select className={styles.control} value={kind} onChange={(e) => setKind(e.target.value as GoalKind)}>
              <option value="goal">Meta (valor-alvo)</option>
              <option value="emergency">Reserva de emergência (meses de despesa)</option>
            </select>
          </label>
          {kind === "goal" ? (
            <label className={styles.filterField}>
              Valor-alvo
              <CurrencyInput className={styles.control} value={target} onChange={setTarget} />
            </label>
          ) : (
            <label className={styles.filterField}>
              Meses de despesa
              <input
                className={styles.control}
                type="number"
                min={1}
                max={60}
                value={months}
                onChange={(e) => setMonths(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
              />
            </label>
          )}
          <label className={styles.filterField}>
            Conta vinculada
            <select className={styles.control} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Guardar manualmente</option>
              {eligible.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            onClick={() => void create()}
            disabled={busy || !name.trim() || (kind === "goal" && target <= 0)}
          >
            Adicionar meta
          </Button>
        </div>
      )}
      {goals.error && (
        <EmptyState title="Não foi possível carregar as metas" message={goals.error.message} actions={[{ label: "Tentar de novo", onClick: goals.reload }]} />
      )}
      {goals.data && items.length === 0 && <p className={styles.empty}>Nenhuma meta ainda.</p>}
      {items.length > 0 && (
        <ul className={styles.list} aria-label="Metas">
          {items.map((g) => (
            <li key={g.id} className={styles.listItem}>
              <span className={styles.listMain}>
                <strong>{g.name}</strong>{" "}
                <span className={styles.listMeta}>
                  · {formatCents(g.savedCents)} de {formatCents(g.effectiveTargetCents)}
                  {g.progress !== null ? ` (${Math.round(g.progress * 100)}%)` : ""}
                  {g.kind === "emergency" && g.monthsCovered !== null
                    ? ` · cobre ${g.monthsCovered.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de ${g.targetMonths} meses de despesa`
                    : ""}
                  {g.accountId ? " · acompanha o saldo da conta" : ""}
                </span>
                <span className={styles.track} role="img" aria-label={`${g.name}: ${Math.round((g.progress ?? 0) * 100)}% da meta`} style={{ display: "block" }}>
                  <span className={styles.fill} style={{ display: "block", width: `${(g.progress ?? 0) * 100}%`, background: "var(--tone-green)" }} />
                </span>
              </span>
              <span className={styles.rowActions}>
                {!g.accountId && (
                  <>
                    <Button onClick={() => setMoving({ goal: g, sign: 1 })} aria-label={`Guardar em ${g.name}`}>Guardar</Button>
                    <Button onClick={() => setMoving({ goal: g, sign: -1 })} aria-label={`Retirar de ${g.name}`}>Retirar</Button>
                  </>
                )}
                <Button onClick={() => void archive(g)} aria-label={`Arquivar ${g.name}`}>Arquivar</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {moving && (
        <ValueModal
          title={moving.sign > 0 ? "Guardar na meta" : "Retirar da meta"}
          label={`${moving.sign > 0 ? "Quanto guardar" : "Quanto retirar"} em “${moving.goal.name}” (R$)`}
          initial="100"
          min={0.01}
          confirmLabel={moving.sign > 0 ? "Guardar" : "Retirar"}
          onConfirm={(v) => contribute(moving.goal, moving.sign, v)}
          onClose={() => setMoving(null)}
        />
      )}
      <p className={form.hint}>
        A reserva de emergência usa a média de despesa dos últimos 3 meses completos do perfil.
      </p>
    </section>
  );
}
