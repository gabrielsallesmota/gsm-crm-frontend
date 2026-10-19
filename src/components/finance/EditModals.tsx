import { useId, useState } from "react";
import type { FinAccount, FinCategory } from "../../types/finance";
import { useFinanceAccounts } from "../../hooks/useFinance";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Modal } from "../common/Modal";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import form from "../common/Form.module.css";

/** Edita nome, cor e orçamento mensal (despesas). O tipo e o perfil da categoria não mudam. */
export function CategoryEditModal({
  category,
  onClose,
  onSaved,
}: {
  category: FinCategory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [budget, setBudget] = useState((category.monthlyBudgetCents ?? 0) / 100);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await financeService.updateCategory(category.id, {
        name: name.trim(),
        color,
        ...(category.kind === "expense"
          ? { monthlyBudgetCents: budget > 0 ? Math.round(budget * 100) : null }
          : {}),
      });
      toast("Categoria atualizada");
      onSaved();
      onClose();
    } catch (err) {
      toastError(err, "Não foi possível atualizar a categoria");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Editar categoria" onClose={onClose}>
      <div className={form.form}>
        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-name`}>Nome</label>
          <input id={`${uid}-name`} className={form.input} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={form.row}>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-color`}>Cor</label>
            <input id={`${uid}-color`} type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 48, height: 36 }} />
          </div>
        </div>
        {category.kind === "expense" && (
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-budget`}>Orçamento mensal</label>
            <CurrencyInput id={`${uid}-budget`} className={form.input} value={budget} onChange={setBudget} />
            <span className={form.hint}>Zero remove o orçamento.</span>
          </div>
        )}
        <p className={form.hint}>A categoria pertence ao perfil em que foi criada e não muda de perfil.</p>
        <div className={form.actions}>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || !name.trim()}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Edita nome e PF/PJ; no cartão, também fechamento, vencimento e limite. */
export function AccountEditModal({
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
  const isCard = account.kind === "cartao";
  const [name, setName] = useState(account.name);
  const [closingDay, setClosingDay] = useState(account.closingDay ?? 10);
  const [dueDay, setDueDay] = useState(account.dueDay ?? 20);
  const [limit, setLimit] = useState((account.creditLimitCents ?? 0) / 100);
  const accounts = useFinanceAccounts(false);
  const [payerId, setPayerId] = useState(account.payerAccountId ?? "");
  const payers = (accounts.data ?? []).filter(
    (a) => a.kind !== "cartao" && !a.archived && a.profileId === account.profileId,
  );
  const [busy, setBusy] = useState(false);
  const daysOk = !isCard || [closingDay, dueDay].every((d) => Number.isInteger(d) && d >= 1 && d <= 28);

  async function save() {
    setBusy(true);
    try {
      await financeService.updateAccount(account.id, {
        name: name.trim(),
        ...(isCard
          ? {
              closingDay,
              dueDay,
              creditLimitCents: limit > 0 ? Math.round(limit * 100) : null,
              ...(payerId !== (account.payerAccountId ?? "") ? { payerAccountId: payerId || null } : {}),
            }
          : {}),
      });
      toast(isCard ? "Cartão atualizado" : "Conta atualizada");
      onSaved();
      onClose();
    } catch (err) {
      toastError(err, "Não foi possível atualizar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isCard ? "Editar cartão" : "Editar conta"} onClose={onClose}>
      <div className={form.form}>
        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-name`}>Nome</label>
          <input id={`${uid}-name`} className={form.input} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <p className={form.hint}>A conta pertence ao perfil em que foi criada e não muda de perfil.</p>
        {isCard && (
          <>
            <div className={form.row}>
              <div className={form.field}>
                <label className={form.label} htmlFor={`${uid}-closing`}>Dia do fechamento</label>
                <input id={`${uid}-closing`} className={form.input} type="number" min={1} max={28} value={closingDay} onChange={(e) => setClosingDay(Number(e.target.value))} />
              </div>
              <div className={form.field}>
                <label className={form.label} htmlFor={`${uid}-due`}>Dia do vencimento</label>
                <input id={`${uid}-due`} className={form.input} type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))} />
              </div>
            </div>
            <div className={form.field}>
              <label className={form.label} htmlFor={`${uid}-payer`}>Conta pagadora</label>
              <select id={`${uid}-payer`} className={form.select} value={payerId} onChange={(e) => setPayerId(e.target.value)}>
                <option value="">Escolher ao pagar</option>
                {payers.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className={form.field}>
              <label className={form.label} htmlFor={`${uid}-limit`}>Limite</label>
              <CurrencyInput id={`${uid}-limit`} className={form.input} value={limit} onChange={setLimit} />
            </div>
            <p className={form.hint}>
              Mudar fechamento ou vencimento vale para as faturas que ainda não fecharam; as faturas já fechadas
              continuam como estavam.
            </p>
            {!daysOk && <p className={form.error} role="alert">Fechamento e vencimento ficam entre 1 e 28.</p>}
          </>
        )}
        <div className={form.actions}>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || !name.trim() || !daysOk}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
