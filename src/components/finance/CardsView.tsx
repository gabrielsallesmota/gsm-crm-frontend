import { useEffect, useId, useState } from "react";
import type {
  CardOverview,
  FinScope,
  InvoiceStatus,
  InvoiceSummary,
} from "../../types/finance";
import { INVOICE_STATUS_LABEL, SCOPE_SHORT } from "../../types/finance";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { CurrencyInput } from "../common/CurrencyInput";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import { useFinanceCards, useInvoice, useInvoices } from "../../hooks/useFinance";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { barRatio, budgetTone, formatCents, limitUsage, monthTitle } from "../../utils/finance";
import { fmtDate } from "../../utils/renewal";
import styles from "./Finance.module.css";

const STATUS_TONE: Record<InvoiceStatus, { color: string; bg: string }> = {
  open: { color: "var(--tone-blue-text)", bg: "var(--tone-blue-bg)" },
  closed: { color: "var(--tone-amber-text)", bg: "var(--tone-amber-bg)" },
  overdue: { color: "var(--tone-red-text)", bg: "var(--tone-red-bg)" },
  paid: { color: "var(--tone-green-text)", bg: "var(--tone-green-bg)" },
  empty: { color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge label={INVOICE_STATUS_LABEL[status]} color={STATUS_TONE[status].color} bg={STATUS_TONE[status].bg} />
  );
}

/**
 * Cartões de crédito: limite, fatura atual e próxima, histórico de faturas e o detalhe de cada uma
 * (compras, parcelas, categorias). Pagar a fatura só dá baixa nos itens — a despesa já conta na data
 * da compra, então nada é contado duas vezes.
 */
export function CardsView({
  scope,
  refreshToken,
  onChanged,
  onNewPurchase,
}: {
  scope: FinScope | undefined;
  refreshToken: number;
  onChanged: () => void;
  onNewPurchase: (accountId: string) => void;
}) {
  const cards = useFinanceCards();
  const [selected, setSelected] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    if (refreshToken > 0) cards.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const visible = (cards.data ?? []).filter((c) => !scope || c.account.scope === scope);
  const chosen = visible.find((c) => c.account.id === selected) ?? visible[0] ?? null;

  function changed() {
    cards.reload();
    onChanged();
  }

  if (cards.error) {
    return (
      <EmptyState
        title="Não foi possível carregar os cartões"
        message={cards.error.message}
        actions={[{ label: "Tentar de novo", onClick: cards.reload }]}
      />
    );
  }
  if (!cards.data) return <SkeletonRows rows={3} label="Carregando os cartões" />;

  return (
    <div>
      <NewCardForm onCreated={changed} />
      {visible.length === 0 ? (
        <p className={styles.empty} style={{ marginTop: 14 }}>
          Nenhum cartão {scope ? `${SCOPE_SHORT[scope]} ` : ""}cadastrado. Cadastre o cartão com o dia de
          fechamento e de vencimento para acompanhar fatura, limite e parcelas.
        </p>
      ) : (
        <>
          <div className={styles.grid} role="list" aria-label="Cartões" style={{ marginTop: 14 }}>
            {visible.map((c) => (
              <CardTile
                key={c.account.id}
                card={c}
                active={c.account.id === chosen?.account.id}
                onSelect={() => {
                  setSelected(c.account.id);
                  setRef(null);
                }}
              />
            ))}
          </div>
          {chosen && (
            <CardDetail
              key={chosen.account.id}
              card={chosen}
              refText={ref}
              onRef={setRef}
              onChanged={changed}
              onNewPurchase={() => onNewPurchase(chosen.account.id)}
            />
          )}
        </>
      )}
    </div>
  );
}

function CardTile({
  card,
  active,
  onSelect,
}: {
  card: CardOverview;
  active: boolean;
  onSelect: () => void;
}) {
  const usage = limitUsage(card.usedCents, card.account.creditLimitCents);
  const tone = budgetTone(usage);
  return (
    <div role="listitem" style={{ display: "contents" }}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={styles.card}
        style={{
          textAlign: "left",
          cursor: "pointer",
          borderColor: active ? "var(--tone-blue-text)" : undefined,
          color: "var(--text)",
        }}
      >
        <span className={styles.cardTitle}>
          {card.account.name} · {SCOPE_SHORT[card.account.scope]}
        </span>
        <span className={styles.kpiLabel} style={{ display: "block" }}>
          Fatura atual ({monthTitle(card.current.ref)})
        </span>
        <span className={styles.kpiValue} style={{ display: "block" }}>
          {formatCents(card.current.total)}
        </span>
        <span className={styles.kpiNote} style={{ display: "block" }}>
          fecha {fmtDate(card.current.closingDate)} · vence {fmtDate(card.current.dueDate)}{" "}
          <StatusBadge status={card.current.status} />
        </span>
        <span className={styles.kpiNote} style={{ display: "block", marginTop: 6 }}>
          Próxima: {formatCents(card.next.total)}
        </span>
        {usage !== null && (
          <span style={{ display: "block", marginTop: 10 }}>
            <span
              className={styles.track}
              style={{ display: "block" }}
              role="img"
              aria-label={`Limite usado: ${Math.round(usage * 100)}%`}
            >
              <span
                className={styles.fill}
                style={{
                  display: "block",
                  width: `${barRatio(card.usedCents, card.account.creditLimitCents ?? 1) * 100}%`,
                  background:
                    tone === "over" ? "var(--tone-red)" : tone === "warn" ? "var(--tone-amber)" : "var(--tone-blue)",
                }}
              />
            </span>
            <span
              className={`${styles.budgetNote} ${tone === "over" ? styles.budgetOver : tone === "warn" ? styles.budgetWarn : ""}`}
              style={{ display: "block" }}
            >
              {formatCents(card.availableCents ?? 0)} disponível de {formatCents(card.account.creditLimitCents ?? 0)}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}

function CardDetail({
  card,
  refText,
  onRef,
  onChanged,
  onNewPurchase,
}: {
  card: CardOverview;
  refText: string | null;
  onRef: (ref: string) => void;
  onChanged: () => void;
  onNewPurchase: () => void;
}) {
  const { toast, toastError } = useToast();
  const invoices = useInvoices(card.account.id);
  const ref = refText ?? card.current.ref;
  const detail = useInvoice(card.account.id, ref);
  const [confirmPay, setConfirmPay] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [payDate, setPayDate] = useState("");
  const history = invoices.data ?? [];

  function changed() {
    invoices.reload();
    detail.reload();
    onChanged();
  }

  async function pay(): Promise<boolean> {
    try {
      const count = await financeService.payInvoice(card.account.id, ref, payDate || undefined);
      toast(count === 1 ? "1 item baixado" : `${count} itens baixados`);
      changed();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível pagar a fatura");
      return false;
    }
  }

  async function undo(): Promise<boolean> {
    try {
      await financeService.unpayInvoice(card.account.id, ref);
      toast("Pagamento da fatura estornado");
      changed();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível estornar o pagamento");
      return false;
    }
  }

  const inv = detail.data?.invoice;

  return (
    <section className={styles.card} style={{ marginTop: 14 }} aria-label={`Fatura de ${card.account.name}`}>
      <div className={styles.toolbar} style={{ justifyContent: "space-between" }}>
        <h3 className={styles.cardTitle} style={{ margin: 0 }}>
          Faturas — {card.account.name}
        </h3>
        <Button onClick={onNewPurchase}>+ Compra no cartão</Button>
      </div>

      <InvoicePicker history={history} current={ref} fallback={card.current} onPick={onRef} />

      {detail.error && (
        <EmptyState title="Não foi possível carregar a fatura" message={detail.error.message} />
      )}
      {!detail.error && !detail.data && <SkeletonRows rows={3} label="Carregando a fatura" />}

      {detail.data && inv && (
        <div>
          <div className={styles.grid} style={{ marginTop: 12 }}>
            <div className={styles.pendingBox}>
              <p className={styles.kpiLabel}>Total da fatura</p>
              <strong className={styles.kpiValue}>{formatCents(inv.total)}</strong>
              <p className={styles.kpiNote}>
                <StatusBadge status={inv.status} /> {inv.count} {inv.count === 1 ? "item" : "itens"}
              </p>
            </div>
            <div className={styles.pendingBox}>
              <p className={styles.kpiLabel}>Ciclo</p>
              <strong>
                {fmtDate(inv.periodStart)} a {fmtDate(inv.closingDate)}
              </strong>
              <p className={styles.kpiNote}>Vence em {fmtDate(inv.dueDate)}</p>
            </div>
            <div className={styles.pendingBox}>
              <p className={styles.kpiLabel}>Pago</p>
              <strong>{formatCents(inv.paidTotal)}</strong>
              <p className={styles.kpiNote}>
                {inv.status === "paid" && inv.paidOn ? `em ${fmtDate(inv.paidOn)}` : `${inv.unpaidCount} a pagar`}
              </p>
            </div>
          </div>

          {inv.count > 0 && (
            <div className={styles.toolbar}>
              {inv.unpaidCount > 0 && (
                <>
                  <label className={styles.filterField}>
                    Data do pagamento
                    <input
                      className={styles.control}
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                    />
                  </label>
                  <Button variant="primary" onClick={() => setConfirmPay(true)}>
                    Pagar fatura
                  </Button>
                </>
              )}
              {inv.paidTotal > 0 && <Button onClick={() => setConfirmUndo(true)}>Estornar pagamento</Button>}
            </div>
          )}

          {detail.data.byCategory.length > 0 && (
            <ul className={styles.catList} aria-label="Fatura por categoria" style={{ marginBottom: 14 }}>
              {detail.data.byCategory.map((c) => (
                <li key={c.name}>
                  <div className={styles.catHead}>
                    <span className={styles.catName}>
                      <span className={styles.dot} style={{ background: c.color }} aria-hidden="true" />
                      {c.name}
                    </span>
                    <strong>{formatCents(c.total)}</strong>
                  </div>
                  <div className={styles.track} role="img" aria-label={`${c.name}: ${Math.round(barRatio(c.total, inv.total) * 100)}% da fatura`}>
                    <div className={styles.fill} style={{ width: `${barRatio(c.total, inv.total) * 100}%`, background: c.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {detail.data.entries.length === 0 ? (
            <p className={styles.empty}>Nenhuma compra nesta fatura.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Compra</th>
                    <th>Parcela</th>
                    <th>Situação</th>
                    <th className={styles.num}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{fmtDate(e.entryDate)}</td>
                      <td>{e.description}</td>
                      <td>{e.installmentNo ? `${e.installmentNo}/${e.installmentTotal}` : "à vista"}</td>
                      <td>{e.paidAt ? "Paga" : "Em aberto"}</td>
                      <td className={styles.num}>{formatCents(e.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {confirmPay && inv && (
        <ConfirmDialog
          title="Pagar a fatura?"
          message={`Todos os itens em aberto de ${monthTitle(inv.ref)} (${formatCents(inv.total - inv.paidTotal)}) serão baixados${payDate ? ` em ${fmtDate(payDate)}` : " hoje"}. Isso não cria uma despesa nova: as compras já contam no dia em que foram feitas.`}
          confirmLabel="Pagar fatura"
          onConfirm={pay}
          onClose={() => setConfirmPay(false)}
        />
      )}
      {confirmUndo && inv && (
        <ConfirmDialog
          title="Estornar o pagamento?"
          message="Os itens da fatura voltam para 'em aberto' e o limite do cartão é comprometido de novo."
          confirmLabel="Estornar"
          onConfirm={undo}
          onClose={() => setConfirmUndo(false)}
        />
      )}
    </section>
  );
}

function InvoicePicker({
  history,
  current,
  fallback,
  onPick,
}: {
  history: InvoiceSummary[];
  current: string;
  fallback: InvoiceSummary;
  onPick: (ref: string) => void;
}) {
  const list = history.length > 0 ? history : [fallback];
  return (
    <div className={styles.seg} role="group" aria-label="Escolher fatura" style={{ flexWrap: "wrap", marginTop: 10 }}>
      {list.slice(0, 12).map((i) => (
        <button
          key={i.ref}
          type="button"
          aria-pressed={i.ref === current}
          className={i.ref === current ? `${styles.segBtn} ${styles.segActive}` : styles.segBtn}
          onClick={() => onPick(i.ref)}
        >
          {monthTitle(i.ref).replace(" de ", "/").slice(0, 8)} · {formatCents(i.total)}
        </button>
      ))}
    </div>
  );
}

function NewCardForm({ onCreated }: { onCreated: () => void }) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<FinScope>("pj");
  const [closingDay, setClosingDay] = useState(10);
  const [dueDay, setDueDay] = useState(20);
  const [limit, setLimit] = useState(0);
  const [busy, setBusy] = useState(false);
  const validDays = [closingDay, dueDay].every((d) => Number.isInteger(d) && d >= 1 && d <= 28);

  async function create() {
    setBusy(true);
    try {
      await financeService.createAccount({
        name: name.trim(),
        scope,
        kind: "cartao",
        closingDay,
        dueDay,
        creditLimitCents: limit > 0 ? Math.round(limit * 100) : null,
      });
      toast("Cartão cadastrado");
      setName("");
      setLimit(0);
      setOpen(false);
      onCreated();
    } catch (err) {
      toastError(err, "Não foi possível cadastrar o cartão");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)}>+ Novo cartão</Button>;
  return (
    <div className={styles.inlineForm} role="group" aria-label="Novo cartão">
      <label className={styles.filterField} htmlFor={`${uid}-name`}>
        Nome
        <input id={`${uid}-name`} className={styles.control} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank PJ" />
      </label>
      <label className={styles.filterField} htmlFor={`${uid}-scope`}>
        De quem
        <select id={`${uid}-scope`} className={styles.control} value={scope} onChange={(e) => setScope(e.target.value as FinScope)}>
          <option value="pj">PJ</option>
          <option value="pf">PF</option>
        </select>
      </label>
      <label className={styles.filterField} htmlFor={`${uid}-closing`}>
        Dia do fechamento
        <input id={`${uid}-closing`} className={styles.control} type="number" min={1} max={28} value={closingDay} onChange={(e) => setClosingDay(Number(e.target.value))} />
      </label>
      <label className={styles.filterField} htmlFor={`${uid}-due`}>
        Dia do vencimento
        <input id={`${uid}-due`} className={styles.control} type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))} />
      </label>
      <label className={styles.filterField} htmlFor={`${uid}-limit`}>
        Limite
        <CurrencyInput id={`${uid}-limit`} className={styles.control} value={limit} onChange={setLimit} />
      </label>
      <div className={styles.rowActions}>
        <Button onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
        <Button variant="primary" onClick={() => void create()} disabled={busy || !name.trim() || !validDays}>
          Cadastrar cartão
        </Button>
      </div>
      {!validDays && <p className={styles.budgetOver}>Fechamento e vencimento ficam entre 1 e 28.</p>}
    </div>
  );
}
