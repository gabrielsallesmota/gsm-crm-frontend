import { useEffect, useId, useState, type ReactNode } from "react";
import type { FinAccount, FinProfile } from "../../types/finance";
import type {
  AccrualRow,
  BudgetVsActualMonth,
  CashFlowRow,
  CategoryReport,
  FutureInvoicesReport,
  NetWorthReport,
  PayablesReceivablesReport,
  PeriodState,
  PjReport,
  ReportKind,
  StatementReport,
  TransfersReport,
} from "../../types/financeReports";
import { REPORT_LABEL } from "../../types/financeReports";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { Modal } from "../common/Modal";
import { SkeletonRows } from "../common/Skeleton";
import { useFinancePeriods } from "../../hooks/useFinance";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { TRANSFER_KIND_LABEL, type TransferKind } from "../../types/finance";
import { formatCents, monthTitle, shiftMonth, currentMonth } from "../../utils/finance";
import { fmtDate, toIsoDate } from "../../utils/renewal";
import form from "../common/Form.module.css";
import styles from "./Finance.module.css";

const KINDS = Object.keys(REPORT_LABEL) as ReportKind[];

function Table({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return (
    <div className={styles.tableWrap} role="region" aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i > 0 && /R\$|valor|total|saldo|%/i.test(h) ? styles.num : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const money = (cents: number) => <td className={styles.num}>{formatCents(cents)}</td>;

/**
 * Relatórios: caixa × competência, extrato, categorias, patrimônio, orçamento × realizado, faturas,
 * a pagar/receber, transferências e resultado gerencial PJ — e o fechamento mensal.
 */
export function ReportsView({
  profiles,
  profileId,
  accounts,
}: {
  profiles: FinProfile[];
  profileId: string | undefined;
  accounts: FinAccount[];
}) {
  const uid = useId();
  const { toastError } = useToast();
  const [kind, setKind] = useState<ReportKind>("cash-flow");
  const [months, setMonths] = useState(12);
  const [from, setFrom] = useState(`${currentMonth()}-01`);
  const [to, setTo] = useState(toIsoDate(new Date()));
  const [accountId, setAccountId] = useState("");
  const [pjId, setPjId] = useState("");
  // O resultado guarda de qual relatório veio: nunca desenha dados de um relatório no outro.
  const [result, setResult] = useState<{ kind: ReportKind; data: unknown } | null>(null);
  const [loading, setLoading] = useState(false);
  const movable = accounts.filter((a) => a.kind !== "cartao" && !a.archived && (!profileId || a.profileId === profileId));
  const pjProfiles = profiles.filter((p) => p.kind === "pj" && !p.archived);
  const account = movable.find((a) => a.id === accountId) ?? movable[0];
  const pj = pjProfiles.find((p) => p.id === (profileId ?? pjId)) ?? (profileId ? undefined : pjProfiles[0]);
  const budgetProfile = profileId ?? profiles.find((p) => !p.archived)?.id;

  useEffect(() => {
    let alive = true;
    const params: Record<string, string | number | undefined> = {};
    if (profileId) params.profile_id = profileId;
    if (["cash-flow", "accrual", "net-worth"].includes(kind)) params.months = months;
    if (["by-category", "transfers", "pj-management", "statement"].includes(kind)) {
      params.date_from = from;
      params.date_to = to;
    }
    if (kind === "statement") {
      if (!account) {
        setResult(null);
        return;
      }
      params.account_id = account.id;
      delete params.profile_id;
    }
    if (kind === "pj-management") {
      if (!pj) {
        setResult(null);
        return;
      }
      params.profile_id = pj.id;
    }
    if (kind === "budget-vs-actual") {
      if (!budgetProfile) return;
      params.profile_id = budgetProfile;
      params.months = Math.min(months, 12);
    }
    setLoading(true);
    financeService
      .report<unknown>(kind, params)
      .then((data) => alive && setResult({ kind, data }))
      .catch((err) => {
        if (alive) {
          setResult(null);
          toastError(err, "Não foi possível gerar o relatório");
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [kind, months, from, to, profileId, account?.id, pj?.id, budgetProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const usesMonths = ["cash-flow", "accrual", "net-worth", "budget-vs-actual"].includes(kind);
  const usesRange = ["by-category", "transfers", "pj-management", "statement"].includes(kind);

  return (
    <div>
      <section className={styles.card} aria-labelledby={`${uid}-rep`}>
        <h3 id={`${uid}-rep`} className={styles.cardTitle}>Relatórios</h3>
        <div className={styles.inlineForm}>
          <label className={styles.filterField}>
            Relatório
            <select className={styles.control} value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>{REPORT_LABEL[k]}</option>
              ))}
            </select>
          </label>
          {usesMonths && (
            <label className={styles.filterField}>
              Meses
              <select className={styles.control} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {[3, 6, 12, 24].map((m) => (
                  <option key={m} value={m}>Últimos {m}</option>
                ))}
              </select>
            </label>
          )}
          {usesRange && (
            <>
              <label className={styles.filterField}>
                De
                <input className={styles.control} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className={styles.filterField}>
                Até
                <input className={styles.control} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          )}
          {kind === "statement" && (
            <label className={styles.filterField}>
              Conta
              <select className={styles.control} value={account?.id ?? ""} onChange={(e) => setAccountId(e.target.value)}>
                {movable.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          )}
          {kind === "pj-management" && !profileId && (
            <label className={styles.filterField}>
              Perfil PJ
              <select className={styles.control} value={pj?.id ?? ""} onChange={(e) => setPjId(e.target.value)}>
                {pjProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {kind === "pj-management" && !pj && (
          <EmptyState title="Escolha um perfil PJ" message="O resultado gerencial vale só para perfis de empresa." />
        )}
        {loading && <SkeletonRows rows={3} label="Gerando o relatório" />}
        {!loading && result !== null && result.kind === kind && (
          <ReportBody kind={kind} data={result.data} />
        )}
      </section>
      <PeriodsSection profiles={profiles} profileId={profileId} />
    </div>
  );
}

function ReportBody({ kind, data }: { kind: ReportKind; data: unknown }) {
  switch (kind) {
    case "cash-flow": {
      const rows = (data as { rows: CashFlowRow[] }).rows;
      return (
        <Table caption="Fluxo de caixa por mês" head={["Mês", "Entradas (R$)", "Saídas (R$)", "Saldo do mês (R$)"]}>
          {rows.map((r) => (
            <tr key={r.month}>
              <td>{monthTitle(r.month)}</td>
              {money(r.inflowCents)}
              {money(r.outflowCents)}
              {money(r.netCents)}
            </tr>
          ))}
        </Table>
      );
    }
    case "accrual": {
      const rows = (data as { rows: AccrualRow[] }).rows;
      return (
        <Table caption="Resultado por competência" head={["Mês", "Receitas (R$)", "Despesas (R$)", "Resultado (R$)"]}>
          {rows.map((r) => (
            <tr key={r.month}>
              <td>{monthTitle(r.month)}</td>
              {money(r.incomeCents)}
              {money(r.expenseCents)}
              {money(r.resultCents)}
            </tr>
          ))}
        </Table>
      );
    }
    case "statement": {
      const s = data as StatementReport;
      return (
        <>
          <p>Saldo inicial <strong>{formatCents(s.openingCents)}</strong> · saldo final <strong>{formatCents(s.closingCents)}</strong></p>
          <Table caption="Extrato da conta" head={["Data", "Movimento", "Valor (R$)", "Saldo (R$)"]}>
            {s.rows.map((r, i) => (
              <tr key={`${r.date}-${i}`}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.description}</td>
                {money(r.amountCents)}
                {money(r.balanceCents)}
              </tr>
            ))}
          </Table>
        </>
      );
    }
    case "by-category": {
      const c = data as CategoryReport;
      return (
        <>
          <p>Total <strong>{formatCents(c.totalCents)}</strong></p>
          <Table caption="Por categoria" head={["Categoria", "Total (R$)", "% do total", "Lançamentos"]}>
            {c.rows.map((r) => (
              <tr key={r.categoryId ?? r.name}>
                <td><span className={styles.dot} style={{ background: r.color }} aria-hidden="true" /> {r.name}</td>
                {money(r.totalCents)}
                <td className={styles.num}>{r.share === null ? "—" : `${Math.round(r.share * 100)}%`}</td>
                <td className={styles.num}>{r.count}</td>
              </tr>
            ))}
          </Table>
        </>
      );
    }
    case "net-worth": {
      const n = data as NetWorthReport;
      return (
        <>
          <p>
            Saldos das contas <strong>{formatCents(n.liquidCents)}</strong> · dívida de cartões{" "}
            <strong>{formatCents(n.cardDebtCents)}</strong> · posição líquida <strong>{formatCents(n.netPositionCents)}</strong>
          </p>
          <Table caption="Saldo das contas ao fim de cada mês" head={["Mês", "Saldo (R$)"]}>
            {n.series.map((r) => (
              <tr key={r.month}>
                <td>{monthTitle(r.month)}</td>
                {money(r.liquidCents)}
              </tr>
            ))}
          </Table>
        </>
      );
    }
    case "budget-vs-actual": {
      const months = (data as { months: BudgetVsActualMonth[] }).months;
      return (
        <Table caption="Orçamento × realizado" head={["Mês", "Orçamento (R$)", "Gasto nas categorias orçadas (R$)", "Gasto total (R$)", "Estouraram"]}>
          {months.map((m) => (
            <tr key={m.month}>
              <td>{monthTitle(m.month)}</td>
              {money(m.budgetCents)}
              {money(m.spentInBudgetedCents)}
              {money(m.spentCents)}
              <td>{m.overBudget.length ? m.overBudget.join(", ") : "—"}</td>
            </tr>
          ))}
        </Table>
      );
    }
    case "future-invoices": {
      const f = data as FutureInvoicesReport;
      return (
        <>
          <p>Total a pagar nas faturas <strong>{formatCents(f.totalCents)}</strong></p>
          <Table caption="Faturas a pagar" head={["Cartão", "Fatura", "Vence em", "Falta (R$)"]}>
            {f.invoices.map((i) => (
              <tr key={`${i.cardName}-${i.ref}`}>
                <td>{i.cardName}</td>
                <td>{monthTitle(i.ref)}</td>
                <td>{fmtDate(i.dueDate)}</td>
                {money(i.remainingCents)}
              </tr>
            ))}
          </Table>
        </>
      );
    }
    case "payables-receivables": {
      const p = data as PayablesReceivablesReport;
      const groups: [string, keyof typeof p.payable][] = [
        ["Atrasado", "overdue"],
        ["Próximos 7 dias", "next7Days"],
        ["Em até 30 dias", "next30Days"],
        ["Depois", "later"],
      ];
      return (
        <div className={styles.grid2}>
          {([["A pagar", p.payable], ["A receber", p.receivable]] as const).map(([title, group]) => (
            <section key={title} aria-label={title}>
              <h4 className={styles.cardTitle}>{title}: {formatCents(group.totalCents)}</h4>
              <Table caption={title} head={["Faixa", "Itens", "Total (R$)"]}>
                {groups.map(([label, key]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td className={styles.num}>{(group[key] as { count: number }).count}</td>
                    {money((group[key] as { totalCents: number }).totalCents)}
                  </tr>
                ))}
              </Table>
            </section>
          ))}
        </div>
      );
    }
    case "transfers": {
      const t = data as TransfersReport;
      return (
        <>
          <p>Total movido entre contas <strong>{formatCents(t.totalCents)}</strong> (não é receita nem despesa)</p>
          <Table caption="Transferências por tipo" head={["Tipo", "De", "Para", "Lançamentos", "Total (R$)"]}>
            {t.rows.map((r, i) => (
              <tr key={`${r.kind}-${i}`}>
                <td>{TRANSFER_KIND_LABEL[r.kind as TransferKind] ?? r.kind}</td>
                <td>{r.fromProfile}</td>
                <td>{r.toProfile}</td>
                <td className={styles.num}>{r.count}</td>
                {money(r.totalCents)}
              </tr>
            ))}
          </Table>
        </>
      );
    }
    case "pj-management": {
      const r = data as PjReport;
      return (
        <>
          <p className={styles.budgetNote} role="note">{r.disclaimer}</p>
          <Table caption="Resultado gerencial" head={["Linha", "Valor (R$)"]}>
            <tr><td>Receita bruta</td>{money(r.incomeCents)}</tr>
            <tr><td>Provisão de impostos{r.taxProvisionBps !== null ? ` (${r.taxProvisionBps / 100}%)` : " (não configurada)"}</td>{money(-r.taxProvisionCents)}</tr>
            <tr><td>Custos fixos</td>{money(-r.costs.fixed)}</tr>
            <tr><td>Custos variáveis</td>{money(-r.costs.variable)}</tr>
            <tr><td>Custos sem classificação</td>{money(-r.costs.unclassified)}</tr>
            <tr><td>Pró-labore</td>{money(-r.proLaboreCents)}</tr>
            <tr><th scope="row">Resultado operacional gerencial</th>{money(r.operatingResultCents)}</tr>
          </Table>
          <p>
            Margem gerencial <strong>{r.margin === null ? "—" : `${(r.margin * 100).toFixed(1).replace(".", ",")}%`}</strong> · distribuição de
            lucros no período {formatCents(r.profitDistributionCents)} (não é custo)
          </p>
          {r.byClient.length > 0 && (
            <Table caption="Por cliente" head={["Cliente", "Receita (R$)", "Custos (R$)", "Resultado (R$)"]}>
              {r.byClient.map((c) => (
                <tr key={c.name ?? ""}>
                  <td>{c.name}</td>
                  {money(c.incomeCents)}
                  {money(c.expenseCents)}
                  {money(c.resultCents)}
                </tr>
              ))}
            </Table>
          )}
          {r.byProject.length > 0 && (
            <Table caption="Por projeto" head={["Projeto", "Receita (R$)", "Custos (R$)", "Resultado (R$)"]}>
              {r.byProject.map((c) => (
                <tr key={c.name ?? ""}>
                  <td>{c.name}</td>
                  {money(c.incomeCents)}
                  {money(c.expenseCents)}
                  {money(c.resultCents)}
                </tr>
              ))}
            </Table>
          )}
        </>
      );
    }
  }
}

// --- fechamento mensal ------------------------------------------------------------------------

function PeriodsSection({ profiles, profileId }: { profiles: FinProfile[]; profileId: string | undefined }) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const active = profiles.filter((p) => !p.archived);
  const target = profileId ?? active[0]?.id;
  const periods = useFinancePeriods(target);
  const [reopening, setReopening] = useState<string | null>(null);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(currentMonth(), -(i + 1)));
  const closed = new Map((periods.data ?? []).filter((p) => p.closed).map((p) => [p.month.slice(0, 7), p] as [string, PeriodState]));

  async function close(month: string) {
    if (!target) return;
    try {
      await financeService.closePeriod(target, month);
      toast(`${monthTitle(month)} fechado`);
      periods.reload();
    } catch (err) {
      toastError(err, "Não foi possível fechar o mês");
    }
  }

  return (
    <section className={`${styles.card} ${styles.sectionGap}`} aria-labelledby={`${uid}-close`}>
      <h3 id={`${uid}-close`} className={styles.cardTitle}>
        Fechamento mensal — {profiles.find((p) => p.id === target)?.name ?? "—"}
      </h3>
      <p className={styles.budgetNote}>
        Mês fechado não aceita criar, alterar nem excluir lançamentos, transferências, ajustes e pagamentos daquele mês.
        Reabrir exige sua senha e um motivo, e fica registrado.
      </p>
      <ul className={styles.list} aria-label="Meses">
        {months.map((m) => {
          const lock = closed.get(m);
          return (
            <li key={m} className={styles.listItem}>
              <span className={styles.listMain}>
                {monthTitle(m)} <span className={styles.listMeta}>· {lock ? "fechado" : "aberto"}</span>
              </span>
              {lock ? (
                <Button onClick={() => setReopening(m)} aria-label={`Reabrir ${monthTitle(m)}`}>Reabrir</Button>
              ) : (
                <Button onClick={() => void close(m)} aria-label={`Fechar ${monthTitle(m)}`}>Fechar mês</Button>
              )}
            </li>
          );
        })}
      </ul>
      {reopening && target && (
        <ReopenModal
          profileId={target}
          month={reopening}
          onClose={() => setReopening(null)}
          onDone={() => periods.reload()}
        />
      )}
    </section>
  );
}

function ReopenModal({
  profileId,
  month,
  onClose,
  onDone,
}: {
  profileId: string;
  month: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const token = await financeService.reauth(password);
      await financeService.reopenPeriod(profileId, month, reason.trim(), token);
      toast(`${monthTitle(month)} reaberto`);
      onDone();
      onClose();
    } catch (err) {
      toastError(err, "Não foi possível reabrir o mês");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <Modal title="Reabrir o mês?" subtitle={monthTitle(month)} onClose={onClose}>
      <div className={form.form}>
        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-reason`}>Motivo</label>
          <input id={`${uid}-reason`} className={form.input} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-pwd`}>Senha</label>
          <input id={`${uid}-pwd`} className={form.input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className={form.actions}>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || !reason.trim() || !password}>
            Reabrir
          </Button>
        </div>
      </div>
    </Modal>
  );
}
