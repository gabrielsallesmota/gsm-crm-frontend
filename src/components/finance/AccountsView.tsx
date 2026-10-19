import { useEffect, useId, useState } from "react";
import type { FinAccount, FinProfile, FinTransfer, TransferKind } from "../../types/finance";
import { TRANSFER_KIND_LABEL } from "../../types/finance";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Modal } from "../common/Modal";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { formatCents, todayIso } from "../../utils/finance";
import { fmtDate } from "../../utils/renewal";
import form from "../common/Form.module.css";
import styles from "./Finance.module.css";

/**
 * Contas: saldo atual (só o que já aconteceu) e previsto (+ pendências), transferências entre contas
 * (que NÃO são receita nem despesa), ajuste de saldo com motivo e conciliação com o extrato.
 */
export function AccountsView({
  accounts,
  profiles,
  profileId,
  onChanged,
}: {
  accounts: FinAccount[];
  profiles: FinProfile[];
  profileId: string | undefined;
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [transfers, setTransfers] = useState<FinTransfer[] | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<FinAccount | null>(null);
  const profileNames = new Map(profiles.map((p) => [p.id, p.name]));
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const movable = accounts.filter((a) => !a.archived && a.kind !== "cartao");
  const visible = movable.filter((a) => !profileId || a.profileId === profileId);

  function reloadTransfers() {
    void financeService
      .listTransfers(profileId ? { profileId } : {})
      .then(setTransfers)
      .catch((err) => toastError(err, "Não foi possível carregar as transferências"));
  }
  useEffect(reloadTransfers, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(t: FinTransfer) {
    try {
      await financeService.deleteTransfer(t.id);
      toast("Transferência removida — os saldos voltaram ao que eram");
      reloadTransfers();
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível remover a transferência");
    }
  }

  const total = visible.reduce((sum, a) => sum + (a.balanceCents ?? 0), 0);

  return (
    <div>
      <section className={styles.card} aria-labelledby={`${uid}-balances`}>
        <div className={styles.header}>
          <h3 id={`${uid}-balances`} className={styles.cardTitle}>Saldos das contas</h3>
          <Button variant="primary" onClick={() => setTransferOpen(true)} disabled={movable.length < 2}>
            + Transferência
          </Button>
        </div>
        {visible.length === 0 ? (
          <p className={styles.empty}>Nenhuma conta ainda. Cadastre uma conta em “Categorias e contas”.</p>
        ) : (
          <>
            <ul className={styles.list}>
              {visible.map((a) => (
                <li key={a.id} className={styles.listItem}>
                  <span className={styles.listMain}>
                    {a.name}{" "}
                    <Badge label={profileNames.get(a.profileId) ?? "—"} color="var(--tone-blue-text)" bg="var(--tone-blue-bg)" />
                    <span className={styles.listMeta}>
                      {a.institution ? ` · ${a.institution}` : ""}
                      {a.lastReconciledOn ? ` · conciliada em ${fmtDate(a.lastReconciledOn)}` : ""}
                    </span>
                  </span>
                  <span className={styles.rowActions}>
                    <span>
                      <strong className={(a.balanceCents ?? 0) < 0 ? styles.negative : undefined}>
                        {formatCents(a.balanceCents ?? 0)}
                      </strong>
                      <span className={styles.listMeta}>
                        {" "}· previsto {formatCents(a.projectedCents ?? 0)}
                      </span>
                    </span>
                    <Button onClick={() => setAdjusting(a)} aria-label={`Conciliar ou ajustar ${a.name}`}>
                      Conciliar / ajustar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.budgetNote}>
              Soma dos saldos: <strong>{formatCents(total)}</strong>. “Atual” conta só o que já aconteceu;
              “previsto” soma as pendências confirmadas até o fim do mês (inclusive as atrasadas).
            </p>
          </>
        )}
      </section>

      <section className={`${styles.card} ${styles.sectionGap}`} aria-labelledby={`${uid}-transfers`}>
        <h3 id={`${uid}-transfers`} className={styles.cardTitle}>Transferências</h3>
        <p className={styles.budgetNote}>
          Mover dinheiro entre contas não é receita nem despesa: não entra nos resultados do painel.
        </p>
        {!transfers ? (
          <p className={styles.empty}>Carregando…</p>
        ) : transfers.length === 0 ? (
          <p className={styles.empty}>Nenhuma transferência.</p>
        ) : (
          <ul className={styles.list} aria-label="Transferências">
            {transfers.map((t) => (
              <li key={t.id} className={styles.listItem}>
                <span className={styles.listMain}>
                  {t.description}{" "}
                  <span className={styles.listMeta}>
                    · {TRANSFER_KIND_LABEL[t.kind]} · {accountNames.get(t.fromAccountId) ?? "—"} →{" "}
                    {accountNames.get(t.toAccountId) ?? "—"} · {fmtDate(t.transferDate)}
                  </span>
                </span>
                <span className={styles.rowActions}>
                  <strong>{formatCents(t.amountCents)}</strong>
                  <Button onClick={() => void remove(t)} aria-label={`Excluir transferência ${t.description}`}>
                    Excluir
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {transferOpen && (
        <TransferModal
          accounts={movable}
          profiles={profiles}
          onClose={() => setTransferOpen(false)}
          onSaved={() => {
            reloadTransfers();
            onChanged();
          }}
        />
      )}
      {adjusting && (
        <ReconcileModal
          account={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function TransferModal({
  accounts,
  profiles,
  onClose,
  onSaved,
}: {
  accounts: FinAccount[];
  profiles: FinProfile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [kind, setKind] = useState<TransferKind>("common");
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const label = (a: FinAccount) => `${a.name} (${names.get(a.profileId) ?? "—"})`;
  const invalid = !from || !to || from === to || amount <= 0 || !description.trim();

  async function save() {
    setBusy(true);
    try {
      await financeService.createTransfer({
        kind,
        fromAccountId: from,
        toAccountId: to,
        amountCents: Math.round(amount * 100),
        transferDate: date,
        description: description.trim(),
      });
      toast("Transferência registrada");
      onSaved();
      onClose();
    } catch (err) {
      toastError(err, "Não foi possível transferir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nova transferência" onClose={onClose}>
      <div className={form.form}>
        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-kind`}>Tipo</label>
          <select id={`${uid}-kind`} className={form.select} value={kind} onChange={(e) => setKind(e.target.value as TransferKind)}>
            {(Object.keys(TRANSFER_KIND_LABEL) as TransferKind[]).map((k) => (
              <option key={k} value={k}>{TRANSFER_KIND_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div className={form.row}>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-from`}>De</label>
            <select id={`${uid}-from`} className={form.select} value={from} onChange={(e) => setFrom(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{label(a)}</option>
              ))}
            </select>
          </div>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-to`}>Para</label>
            <select id={`${uid}-to`} className={form.select} value={to} onChange={(e) => setTo(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{label(a)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={form.row}>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-amount`}>Valor</label>
            <CurrencyInput id={`${uid}-amount`} className={form.input} value={amount} onChange={setAmount} />
          </div>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-date`}>Data</label>
            <input id={`${uid}-date`} className={form.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-desc`}>Descrição</label>
          <input id={`${uid}-desc`} className={form.input} maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className={form.actions}>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || invalid}>
            {busy ? "Salvando…" : "Transferir"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Informa o saldo do extrato: o sistema mostra a diferença e, se quiser, ajusta com motivo. */
function ReconcileModal({
  account,
  onClose,
  onSaved,
}: {
  account: FinAccount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [date, setDate] = useState(todayIso());
  const [statement, setStatement] = useState((account.balanceCents ?? 0) / 100);
  const [difference, setDifference] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(adjust: boolean) {
    setBusy(true);
    try {
      const result = await financeService.reconcile(account.id, {
        on: date,
        statementBalanceCents: Math.round(statement * 100),
        adjust,
      });
      setDifference(result.differenceCents);
      if (result.reconciled) {
        toast(adjust && result.differenceCents !== 0 ? "Ajuste registrado — conta conciliada" : "Conta conciliada");
        onSaved();
        onClose();
      }
    } catch (err) {
      toastError(err, "Não foi possível conciliar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Conciliar ${account.name}`} subtitle="Compare com o saldo do extrato do banco." onClose={onClose}>
      <div className={form.form}>
        <div className={form.row}>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-date`}>Data do extrato</label>
            <input id={`${uid}-date`} className={form.input} type="date" value={date} onChange={(e) => { setDate(e.target.value); setDifference(null); }} />
          </div>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-bal`}>Saldo no extrato</label>
            <CurrencyInput id={`${uid}-bal`} className={form.input} value={statement} onChange={(v) => { setStatement(v); setDifference(null); }} />
          </div>
        </div>
        {difference !== null && difference !== 0 && (
          <p className={form.error} role="alert">
            O sistema está {formatCents(Math.abs(difference))} {difference > 0 ? "abaixo" : "acima"} do extrato. Revise os
            lançamentos ou registre um ajuste de saldo (fica no histórico, com motivo).
          </p>
        )}
        <div className={form.actions}>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={() => void check(false)} disabled={busy}>Conferir</Button>
          {difference !== null && difference !== 0 && (
            <Button variant="primary" onClick={() => void check(true)} disabled={busy}>
              Ajustar saldo
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
