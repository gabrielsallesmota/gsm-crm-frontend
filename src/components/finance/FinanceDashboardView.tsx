import type { CardOverview, CategoryBreakdown, FinanceDashboard } from "../../types/finance";
import { INVOICE_STATUS_LABEL, SCOPE_SHORT } from "../../types/finance";
import {
  barRatio,
  budgetTone,
  compactCents,
  dashboardIsEmpty,
  deltaPercent,
  formatCents,
  formatDelta,
  monthLabel,
  seriesMax,
} from "../../utils/finance";
import { fmtDate } from "../../utils/renewal";
import { Badge } from "../common/Badge";
import styles from "./Finance.module.css";

/**
 * Painel do mês. Competência = data do lançamento; "baixado" = já pago/recebido, "previsto" = ainda
 * a pagar/receber. PF e PJ aparecem lado a lado independentemente do filtro de escopo.
 */
export function FinanceDashboardView({
  data,
  cards = [],
  onNewEntry,
}: {
  data: FinanceDashboard;
  /** Cartões ativos (fatura atual e limite), quando houver. */
  cards?: CardOverview[];
  onNewEntry: () => void;
}) {
  if (dashboardIsEmpty(data)) {
    return (
      <div className={styles.card}>
        <p className={styles.empty}>
          Nenhum lançamento neste mês. Registre sua primeira receita ou despesa para ver o painel.
        </p>
        <button type="button" className={styles.segBtn} onClick={onNewEntry}>
          + Novo lançamento
        </button>
      </div>
    );
  }
  const k = data.kpis;
  const incomeDelta = deltaPercent(k.income, k.previous.income);
  const expenseDelta = deltaPercent(k.expense, k.previous.expense);
  const resultDelta = deltaPercent(k.result, k.previous.result);

  return (
    <div>
      <div className={styles.grid} aria-label="Resumo do mês">
        <Kpi
          label="Receitas"
          value={k.income}
          note={`${formatCents(k.incomePaid)} recebido · ${formatCents(k.incomePending)} a receber`}
          delta={incomeDelta}
          goodWhenUp
        />
        <Kpi
          label="Despesas"
          value={k.expense}
          note={`${formatCents(k.expensePaid)} pago · ${formatCents(k.expensePending)} a pagar`}
          delta={expenseDelta}
          goodWhenUp={false}
        />
        <Kpi
          label="Resultado"
          value={k.result}
          note={
            k.savingsRate === null
              ? "Sem receita no mês"
              : `${Math.round(k.savingsRate * 100)}% da receita sobra`
          }
          delta={resultDelta}
          goodWhenUp
          signed
        />
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Realizado no caixa</h3>
          <p className={styles.kpiValue}>
            <span className={k.incomePaid - k.expensePaid >= 0 ? styles.positive : styles.negative}>
              {formatCents(k.incomePaid - k.expensePaid)}
            </span>
          </p>
          <p className={styles.kpiNote}>Só o que já foi recebido menos o que já foi pago.</p>
        </section>
      </div>

      {cards.length > 0 && <CardsGlance cards={cards} />}

      <div className={styles.grid2}>
        <ScopeSplit data={data} />
        <PendingPanel data={data} />
      </div>

      <section className={styles.card} style={{ marginBottom: 14 }}>
        <h3 className={styles.cardTitle}>Últimos 12 meses</h3>
        <MonthlyChart series={data.series} />
      </section>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Despesas por categoria</h3>
          <CategoryBars items={data.categories.expense} total={k.expense} />
        </section>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Receitas por categoria</h3>
          <CategoryBars items={data.categories.income} total={k.income} />
        </section>
      </div>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Maiores despesas do mês</h3>
          {data.topExpenses.length === 0 ? (
            <p className={styles.empty}>Nenhuma despesa neste mês.</p>
          ) : (
            <ul className={styles.list}>
              {data.topExpenses.map((t) => (
                <li key={t.id} className={styles.listItem}>
                  <span className={styles.listMain}>
                    <span className={styles.listTitle}>{t.description}</span>
                    <span className={styles.listMeta}>
                      {SCOPE_SHORT[t.scope]} · {t.category} · {fmtDate(t.entryDate)}
                    </span>
                  </span>
                  <strong>{formatCents(t.amountCents)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Movimento por dia</h3>
          <DailyBars daily={data.daily} />
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  delta,
  goodWhenUp,
  signed = false,
}: {
  label: string;
  value: number;
  note: string;
  delta: number | null;
  goodWhenUp: boolean;
  signed?: boolean;
}) {
  const good = delta === null ? null : goodWhenUp ? delta >= 0 : delta <= 0;
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{label}</h3>
      <p className={styles.kpiValue}>
        <span className={signed ? (value >= 0 ? styles.positive : styles.negative) : undefined}>
          {formatCents(value)}
        </span>
      </p>
      <p className={styles.kpiNote}>{note}</p>
      <p className={styles.kpiNote}>
        vs. mês anterior:{" "}
        <strong className={good === null ? undefined : good ? styles.positive : styles.negative}>
          {formatDelta(delta)}
        </strong>
      </p>
    </section>
  );
}

function ScopeSplit({ data }: { data: FinanceDashboard }) {
  const rows = [
    { key: "pj", name: "PJ", totals: data.byScope.pj },
    { key: "pf", name: "PF", totals: data.byScope.pf },
  ] as const;
  const max = Math.max(1, ...rows.flatMap((r) => [r.totals.income, r.totals.expense]));
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>PF × PJ</h3>
      {rows.map(({ key, name, totals }) => (
        <div key={key}>
          <div className={styles.splitRow}>
            <span className={styles.splitName}>{name}</span>
            <div>
              <div className={styles.bar} role="img" aria-label={`${name}: receitas ${formatCents(totals.income)}`}>
                <span className={styles.barIncome} style={{ width: `${barRatio(totals.income, max) * 100}%` }} />
              </div>
              <div className={styles.bar} style={{ marginTop: 4 }} role="img" aria-label={`${name}: despesas ${formatCents(totals.expense)}`}>
                <span className={styles.barExpense} style={{ width: `${barRatio(totals.expense, max) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className={styles.splitNums}>
            <span>Receitas {formatCents(totals.income)}</span>
            <span>Despesas {formatCents(totals.expense)}</span>
            <strong className={totals.result >= 0 ? styles.positive : styles.negative}>
              Resultado {formatCents(totals.result)}
            </strong>
          </div>
        </div>
      ))}
    </section>
  );
}

function PendingPanel({ data }: { data: FinanceDashboard }) {
  const p = data.pending;
  const boxes = [
    { label: "A pagar vencido", bucket: p.payableOverdue, bad: true },
    { label: "A pagar em 7 dias", bucket: p.payableSoon, bad: false },
    { label: "A receber atrasado", bucket: p.receivableOverdue, bad: true },
    { label: "A receber em 7 dias", bucket: p.receivableSoon, bad: false },
  ];
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>Pendências</h3>
      <div className={styles.pendingGrid}>
        {boxes.map((b) => (
          <div key={b.label} className={styles.pendingBox}>
            <p className={styles.kpiLabel}>{b.label}</p>
            <strong className={b.bad && b.bucket.count > 0 ? styles.negative : undefined}>
              {formatCents(b.bucket.total)}
            </strong>
            <p className={styles.kpiNote}>
              {b.bucket.count} {b.bucket.count === 1 ? "lançamento" : "lançamentos"}
            </p>
          </div>
        ))}
      </div>
      {p.upcoming.length === 0 ? (
        <p className={styles.empty}>Nada pendente. Tudo em dia.</p>
      ) : (
        <ul className={styles.list} aria-label="Próximos vencimentos">
          {p.upcoming.map((u) => (
            <li key={u.id} className={styles.listItem}>
              <span className={styles.listMain}>
                <span className={styles.listTitle}>{u.description}</span>
                <span className={styles.listMeta}>
                  {u.kind === "income" ? "Receber" : "Pagar"} · {SCOPE_SHORT[u.scope]} ·{" "}
                  {fmtDate(u.dueDate)}
                  {u.overdue && (
                    <>
                      {" "}
                      <Badge label="Atrasado" color="var(--tone-red-text)" bg="var(--tone-red-bg)" />
                    </>
                  )}
                </span>
              </span>
              <strong>{formatCents(u.amountCents)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CategoryBars({ items, total }: { items: CategoryBreakdown[]; total: number }) {
  if (items.length === 0) return <p className={styles.empty}>Sem lançamentos neste mês.</p>;
  return (
    <ul className={styles.catList}>
      {items.map((c) => {
        const tone = budgetTone(c.budgetUsed);
        return (
          <li key={c.categoryId ?? "none"}>
            <div className={styles.catHead}>
              <span className={styles.catName}>
                <span className={styles.dot} style={{ background: c.color }} aria-hidden="true" />
                {c.name}
              </span>
              <span>
                <strong>{formatCents(c.total)}</strong>{" "}
                <span className={styles.muted}>
                  ({total > 0 ? Math.round((c.total / total) * 100) : 0}%)
                </span>
              </span>
            </div>
            <div
              className={styles.track}
              role="img"
              aria-label={`${c.name}: ${total > 0 ? Math.round((c.total / total) * 100) : 0}% do total`}
            >
              <div
                className={styles.fill}
                style={{ width: `${total > 0 ? (c.total / total) * 100 : 0}%`, background: c.color }}
              />
            </div>
            {c.budgetCents !== null && c.budgetUsed !== null && (
              <p
                className={`${styles.budgetNote} ${tone === "over" ? styles.budgetOver : tone === "warn" ? styles.budgetWarn : ""}`}
              >
                Orçamento {formatCents(c.budgetCents)} · {Math.round(c.budgetUsed * 100)}% usado
                {tone === "over" ? " — estourou" : ""}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const W = 720;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 44 };

function MonthlyChart({ series }: { series: FinanceDashboard["series"] }) {
  const max = Math.max(1, seriesMax(series));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / series.length;
  const bar = Math.min(18, slot / 2 - 3);
  const y = (v: number) => PAD.top + innerH - barRatio(v, max) * innerH;
  const ticks = [0, 0.5, 1].map((r) => Math.round(max * r));
  const points = series
    .map((s, i) => `${PAD.left + slot * i + slot / 2},${PAD.top + innerH - Math.max(0, s.result) / max * innerH}`)
    .join(" ");

  return (
    <div>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Receitas, despesas e resultado dos últimos 12 meses, de ${monthLabel(series[0]?.month ?? "")} a ${monthLabel(series[series.length - 1]?.month ?? "")}. Os valores estão na tabela abaixo.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className={styles.chartGrid} x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className={styles.chartLabel} x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
              {compactCents(t)}
            </text>
          </g>
        ))}
        {series.map((s, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          return (
            <g key={s.month}>
              <rect x={cx - bar - 1} width={bar} y={y(s.income)} height={PAD.top + innerH - y(s.income)} fill="var(--tone-green)" rx={2} />
              <rect x={cx + 1} width={bar} y={y(s.expense)} height={PAD.top + innerH - y(s.expense)} fill="var(--tone-red)" rx={2} />
              <text className={styles.chartLabel} x={cx} y={H - 8} textAnchor="middle">
                {monthLabel(s.month)}
              </text>
            </g>
          );
        })}
        <polyline points={points} fill="none" stroke="var(--tone-blue)" strokeWidth={2} />
      </svg>
      <ul className={styles.legend} aria-hidden="true">
        <li><span className={styles.dot} style={{ background: "var(--tone-green)" }} />Receitas</li>
        <li><span className={styles.dot} style={{ background: "var(--tone-red)" }} />Despesas</li>
        <li><span className={styles.dot} style={{ background: "var(--tone-blue)" }} />Resultado (quando positivo)</li>
      </ul>
      <table className="sr-only">
        <caption>Receitas, despesas e resultado por mês</caption>
        <thead>
          <tr><th scope="col">Mês</th><th scope="col">Receitas</th><th scope="col">Despesas</th><th scope="col">Resultado</th></tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.month}>
              <th scope="row">{monthLabel(s.month)}</th>
              <td>{formatCents(s.income)}</td>
              <td>{formatCents(s.expense)}</td>
              <td>{formatCents(s.result)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyBars({ daily }: { daily: FinanceDashboard["daily"] }) {
  if (daily.length === 0) return <p className={styles.empty}>Sem movimento neste mês.</p>;
  const max = Math.max(1, ...daily.flatMap((d) => [d.income, d.expense]));
  return (
    <ul className={styles.list} aria-label="Movimento por dia">
      {daily.map((d) => (
        <li key={d.date} className={styles.listItem}>
          <span style={{ width: 42 }}>{fmtDate(d.date).slice(0, 5)}</span>
          <span style={{ flex: 1 }}>
            <span className={styles.bar} role="img" aria-label={`Receitas ${formatCents(d.income)}`}>
              <span className={styles.barIncome} style={{ width: `${barRatio(d.income, max) * 100}%` }} />
            </span>
            <span className={styles.bar} style={{ marginTop: 3 }} role="img" aria-label={`Despesas ${formatCents(d.expense)}`}>
              <span className={styles.barExpense} style={{ width: `${barRatio(d.expense, max) * 100}%` }} />
            </span>
          </span>
          <span className={styles.num} style={{ minWidth: 96 }}>
            {d.expense > 0 && <span className={styles.negative}>-{formatCents(d.expense).replace("R$ ", "")}</span>}
            {d.income > 0 && <span className={styles.positive}> +{formatCents(d.income).replace("R$ ", "")}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CardsGlance({ cards }: { cards: CardOverview[] }) {
  return (
    <section className={styles.card} style={{ marginBottom: 14 }}>
      <h3 className={styles.cardTitle}>Cartões de crédito</h3>
      <ul className={styles.list} aria-label="Faturas dos cartões">
        {cards.map((c) => (
          <li key={c.account.id} className={styles.listItem}>
            <span className={styles.listMain}>
              <span className={styles.listTitle}>
                {c.account.name} · {SCOPE_SHORT[c.account.scope]}
              </span>
              <span className={styles.listMeta}>
                Fatura atual {INVOICE_STATUS_LABEL[c.current.status].toLowerCase()} · vence{" "}
                {fmtDate(c.current.dueDate)}
                {c.availableCents !== null ? ` · ${formatCents(c.availableCents)} disponível` : ""}
              </span>
            </span>
            <strong>{formatCents(c.current.total)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
