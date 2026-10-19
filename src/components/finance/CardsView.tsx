import { useEffect, useId, useState } from "react";
import type {
  CardOverview,
  FinAccount,
  FinEntry,
  FinProfile,
  InvoiceStatus,
  InvoiceSummary,
} from "../../types/finance";
import { INVOICE_STATUS_LABEL } from "../../types/finance";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { Modal } from "../common/Modal";
import form from "../common/Form.module.css";
import { CurrencyInput } from "../common/CurrencyInput";
import { EmptyState } from "../common/EmptyState";
import { AccountEditModal } from "./EditModals";
import { EntryFormModal } from "./EntryFormModal";
import { SkeletonRows } from "../common/Skeleton";
import {
  useFinanceAccounts,
  useFinanceCards,
  useFinanceCategories,
  useFinanceProfiles,
  useInvoice,
  useInvoices,
} from "../../hooks/useFinance";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { barRatio, budgetTone, formatCents, limitUsage, monthTitle, todayIso } from "../../utils/finance";
import { fmtDate } from "../../utils/renewal";
import styles from "./Finance.module.css";

const STATUS_TONE: Record<InvoiceStatus, { color: string; bg: string }> = {
  open: { color: "var(--tone-blue-text)", bg: "var(--tone-blue-bg)" },
  closed: { color: "var(--tone-amber-text)", bg: "var(--tone-amber-bg)" },
  partial: { color: "var(--tone-amber-text)", bg: "var(--tone-amber-bg)" },
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
  profiles,
  profileId,
  refreshToken,
  onChanged,
  onNewPurchase,
}: {
  profiles: FinProfile[];
  profileId: string | undefined;
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

  const visible = (cards.data ?? []).filter((c) => !profileId || c.account.profileId === profileId);
  const profileNames = new Map(profiles.map((p) => [p.id, p.name]));
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
      <NewCardForm profiles={profiles} defaultProfileId={profileId} onCreated={changed} />
      {visible.length === 0 ? (
        <p className={styles.empty} style={{ marginTop: 14 }}>
          Nenhum cartão {profileId ? "neste perfil " : ""}cadastrado. Cadastre o cartão com o dia de
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
                profileName={profileNames.get(c.account.profileId) ?? "—"}
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
  profileName,
  onSelect,
}: {
  card: CardOverview;
  active: boolean;
  profileName: string;
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
          {card.account.name} · {profileName}
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
  const accounts = useFinanceAccounts(false);
  const [paying, setPaying] = useState(false);
  const [undoing, setUndoing] = useState<{ id: string; amountCents: number } | null>(null);
  const [refunding, setRefunding] = useState<FinEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<FinEntry | null>(null);
  const categories = useFinanceCategories(false);
  const profiles = useFinanceProfiles();
  const [editingCard, setEditingCard] = useState(false);
  const history = invoices.data ?? [];

  function changed() {
    invoices.reload();
    detail.reload();
    onChanged();
  }

  async function undo(): Promise<boolean> {
    if (!undoing) return false;
    try {
      await financeService.undoInvoicePayment(card.account.id, ref, undoing.id);
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
        <span className={styles.rowActions}>
          <Button onClick={() => setEditingCard(true)}>Editar cartão</Button>
          <Button onClick={onNewPurchase}>+ Compra no cartão</Button>
        </span>
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
                {inv.status === "paid" && inv.paidOn
                  ? `em ${fmtDate(inv.paidOn)}`
                  : `faltam ${formatCents(inv.remaining)}`}
              </p>
            </div>
          </div>

          {inv.count > 0 && inv.remaining > 0 && (
            <div className={styles.toolbar}>
              <Button variant="primary" onClick={() => setPaying(true)}>
                Pagar fatura
              </Button>
            </div>
          )}

          {detail.data.payments.length > 0 && (
            <ul className={styles.list} aria-label="Pagamentos da fatura" style={{ marginBottom: 14 }}>
              {detail.data.payments.map((p) => (
                <li key={p.id} className={styles.listItem}>
                  <span className={styles.listMain}>
                    Pagamento de {fmtDate(p.paidOn)}
                    <span className={styles.listMeta}>
                      {p.legacy
                        ? " · anterior à conta pagadora"
                        : ` · ${accounts.data?.find((a) => a.id === p.payerAccountId)?.name ?? "conta pagadora"}`}
                    </span>
                  </span>
                  <span className={styles.rowActions}>
                    <strong>{formatCents(p.amountCents)}</strong>
                    <Button
                      onClick={() => setUndoing({ id: p.id, amountCents: p.amountCents })}
                      aria-label={`Estornar pagamento de ${formatCents(p.amountCents)}`}
                    >
                      Estornar pagamento
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
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
            <div className={styles.tableWrap} role="region" aria-label="Compras da fatura" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Compra</th>
                    <th>Parcela</th>
                    <th>Situação</th>
                    <th className={styles.num}>Valor</th>
                    <th><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{fmtDate(e.entryDate)}</td>
                      <td>{e.description}</td>
                      <td>{e.isRefund ? "estorno" : e.installmentNo ? `${e.installmentNo}/${e.installmentTotal}` : "à vista"}</td>
                      <td>{e.paidAt ? "Paga" : "Em aberto"}</td>
                      <td className={styles.num}>{e.isRefund ? "−" : ""}{formatCents(e.amountCents)}</td>
                      <td>
                        <div className={styles.rowActions}>
                          {!e.isRefund && (
                            <Button onClick={() => setEditingEntry(e)} aria-label={`Editar compra ${e.description}`}>
                              Editar
                            </Button>
                          )}
                          {!e.isRefund && (
                            <Button onClick={() => setRefunding(e)} aria-label={`Estornar compra ${e.description}`}>
                              Estornar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editingEntry && (
        <EntryFormModal
          entry={editingEntry}
          categories={categories.data ?? []}
          accounts={accounts.data ?? []}
          profiles={profiles.data ?? []}
          onClose={() => setEditingEntry(null)}
          onSaved={changed}
        />
      )}
      {editingCard && (
        <AccountEditModal account={card.account} onClose={() => setEditingCard(false)} onSaved={changed} />
      )}
      {paying && inv && (
        <PayInvoiceModal
          card={card}
          invoice={inv}
          accounts={accounts.data ?? []}
          onClose={() => setPaying(false)}
          onPaid={changed}
        />
      )}
      {undoing && (
        <ConfirmDialog
          title="Estornar o pagamento?"
          message={`O pagamento de ${formatCents(undoing.amountCents)} é desfeito: o valor volta para a conta pagadora e a fatura volta a ter esse valor em aberto.`}
          confirmLabel="Estornar"
          onConfirm={undo}
          onClose={() => setUndoing(null)}
        />
      )}
      {refunding && (
        <RefundModal entry={refunding} onClose={() => setRefunding(null)} onDone={changed} />
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

function NewCardForm({
  profiles,
  defaultProfileId,
  onCreated,
}: {
  profiles: FinProfile[];
  defaultProfileId: string | undefined;
  onCreated: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const activeProfiles = profiles.filter((p) => !p.archived);
  const [profileId, setProfileId] = useState(
    defaultProfileId ?? (activeProfiles.find((p) => p.kind === "pj") ?? activeProfiles[0])?.id ?? "",
  );
  const accounts = useFinanceAccounts(false);
  const [payerId, setPayerId] = useState("");
  const payers = (accounts.data ?? []).filter(
    (a) => a.kind !== "cartao" && !a.archived && a.profileId === profileId,
  );
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
        profileId,
        kind: "cartao",
        ...(payerId && payers.some((p) => p.id === payerId) ? { payerAccountId: payerId } : {}),
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
      <label className={styles.filterField} htmlFor={`${uid}-profile`}>
        Perfil
        <select id={`${uid}-profile`} className={styles.control} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          {activeProfiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className={styles.filterField} htmlFor={`${uid}-payer`}>
        Conta pagadora
        <select id={`${uid}-payer`} className={styles.control} value={payerId} onChange={(e) => setPayerId(e.target.value)}>
          <option value="">Escolher ao pagar</option>
          {payers.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
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
        <Button variant="primary" onClick={() => void create()} disabled={busy || !name.trim() || !validDays || !profileId}>
          Cadastrar cartão
        </Button>
      </div>
      {!validDays && <p className={styles.budgetOver}>Fechamento e vencimento ficam entre 1 e 28.</p>}
    </div>
  );
}

/** Pagamento total ou parcial da fatura: escolhe a conta pagadora, o valor e a data. */
function PayInvoiceModal({
  card,
  invoice,
  accounts,
  onClose,
  onPaid,
}: {
  card: CardOverview;
  invoice: InvoiceSummary;
  accounts: FinAccount[];
  onClose: () => void;
  onPaid: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const payers = accounts.filter(
    (a) => a.kind !== "cartao" && !a.archived && a.profileId === card.account.profileId,
  );
  const [payerId, setPayerId] = useState(card.account.payerAccountId ?? payers[0]?.id ?? "");
  const [amount, setAmount] = useState(invoice.remaining / 100);
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const cents = Math.round(amount * 100);
  const invalid = !payerId || cents <= 0 || cents > invoice.remaining;

  async function save() {
    setBusy(true);
    try {
      await financeService.payInvoice(card.account.id, invoice.ref, {
        payerAccountId: payerId,
        amountCents: cents,
        paidAt: date,
      });
      toast(cents === invoice.remaining ? "Fatura paga" : "Pagamento parcial registrado");
      onPaid();
      onClose();
    } catch (err) {
      toastError(err, "Não foi possível pagar a fatura");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Pagar a fatura?" onClose={onClose}>
      <div className={form.form}>
        <p className={form.hint}>
          Fatura de {monthTitle(invoice.ref)}: faltam {formatCents(invoice.remaining)}. O valor sai da conta
          pagadora e isso não cria uma despesa nova — as compras já contam no dia em que foram feitas.
        </p>
        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-payer`}>Conta pagadora</label>
          <select id={`${uid}-payer`} className={form.select} value={payerId} onChange={(e) => setPayerId(e.target.value)}>
            {payers.length === 0 && <option value="">Nenhuma conta do mesmo perfil</option>}
            {payers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className={form.row}>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-amount`}>Valor a pagar</label>
            <CurrencyInput id={`${uid}-amount`} className={form.input} value={amount} onChange={setAmount} />
          </div>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-date`}>Data do pagamento</label>
            <input id={`${uid}-date`} className={form.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {cents > invoice.remaining && (
          <p className={form.error} role="alert">O pagamento não pode passar do que falta na fatura.</p>
        )}
        <div className={form.actions}>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || invalid}>
            {busy ? "Pagando…" : "Pagar fatura"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Estorno (total ou parcial) de uma compra: vira crédito na fatura, nunca receita. */
function RefundModal({ entry, onClose, onDone }: { entry: FinEntry; onClose: () => void; onDone: () => void }) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [amount, setAmount] = useState(entry.amountCents / 100);
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const cents = Math.round(amount * 100);

  async function save() {
    setBusy(true);
    try {
      await financeService.refundPurchase(entry.id, { amountCents: cents, date });
      toast("Estorno registrado na fatura");
      onDone();
      onClose();
    } catch (err) {
      toastError(err, "Não foi possível estornar a compra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Estornar compra" subtitle={entry.description} onClose={onClose}>
      <div className={form.form}>
        <div className={form.row}>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-amount`}>Valor estornado</label>
            <CurrencyInput id={`${uid}-amount`} className={form.input} value={amount} onChange={setAmount} />
          </div>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-date`}>Data do estorno</label>
            <input id={`${uid}-date`} className={form.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <p className={form.hint}>O estorno reduz a despesa e o valor da fatura. Não conta como receita.</p>
        <div className={form.actions}>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || cents <= 0}>
            {busy ? "Estornando…" : "Estornar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
