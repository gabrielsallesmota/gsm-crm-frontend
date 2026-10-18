import { useState } from "react";
import type {
  ClientContract,
  GenerateInstallmentsInput,
  PaymentType,
} from "../../types/client";
import { INSTALLMENT_STATUS_LABEL } from "../../types/client";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { useClientActions } from "../../hooks/useClientActions";
import { useClientInstallments } from "../../hooks/useClientInstallments";
import { useToast } from "../../hooks/useToast";
import { brl } from "../../utils/currency";
import { fmtDate, toIsoDate } from "../../utils/renewal";
import styles from "./ClientDrawer.module.css";

type PlanMode = "equal" | "custom";

function todayIso(): string {
  return toIsoDate(new Date());
}

let customRowSeq = 0;
function nextRowId(): string {
  customRowSeq += 1;
  return `row-${customRowSeq}`;
}

interface CustomRow {
  id: string;
  dueDate: string;
  amountReais: number;
}

function emptyCustomRow(dueDate: string): CustomRow {
  return { id: nextRowId(), dueDate, amountReais: 0 };
}

const STATUS_BADGE: Record<string, { color: string; bg: string }> = {
  pago: { color: "var(--tone-green-text)", bg: "var(--tone-green-bg)" },
  atrasado: { color: "var(--tone-red-text)", bg: "var(--tone-red-bg)" },
  pendente: { color: "var(--tone-amber-text)", bg: "var(--tone-amber-bg)" },
};

/**
 * Parcelas de UM contrato: definir o plano (iguais ou personalizadas), editar valor/vencimento de
 * cada parcela e marcar pago. Só admin e gestor alteram (`canManage`); o vendedor só consulta —
 * o backend recusa de qualquer forma.
 */
export function InstallmentsPanel({
  clientId,
  contract,
  canManage,
  onChanged,
}: {
  clientId: string;
  contract: ClientContract;
  canManage: boolean;
  /** Parcelas mudaram: contrato (valor total) e lista de clientes (próx. vencimento) precisam recarregar. */
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const {
    generateInstallments,
    createCustomInstallmentPlan,
    updateInstallment,
    markInstallmentPaid,
    markInstallmentUnpaid,
  } = useClientActions();
  const { data: installments, reload } = useClientInstallments(clientId, contract.id);

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planMode, setPlanMode] = useState<PlanMode>("equal");
  const [generating, setGenerating] = useState(false);

  const [planPaymentType, setPlanPaymentType] = useState<PaymentType>(contract.paymentType ?? "vista");
  const [planTotalReais, setPlanTotalReais] = useState(
    contract.valueCents ? contract.valueCents / 100 : 0,
  );
  const [planCount, setPlanCount] = useState(contract.installmentCount ?? 1);
  const [planFirstDueDate, setPlanFirstDueDate] = useState(todayIso());

  const [customPaymentType, setCustomPaymentType] = useState<PaymentType>("mensal");
  const [customRows, setCustomRows] = useState<CustomRow[]>([emptyCustomRow(todayIso())]);
  const customTotalReais = customRows.reduce((sum, row) => sum + (row.amountReais || 0), 0);

  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editDueDate, setEditDueDate] = useState("");
  const [editAmountReais, setEditAmountReais] = useState(0);
  const [savingInstallmentEdit, setSavingInstallmentEdit] = useState(false);

  const hasPaidInstallment = (installments ?? []).some((i) => i.paidAt !== null);

  function changed() {
    reload();
    onChanged();
  }

  function openPlanForm() {
    setPlanPaymentType(contract.paymentType ?? "vista");
    setPlanTotalReais(contract.valueCents ? contract.valueCents / 100 : 0);
    setPlanCount(contract.installmentCount ?? 1);
    setPlanFirstDueDate(todayIso());
    setCustomPaymentType("mensal");
    setCustomRows([emptyCustomRow(todayIso())]);
    setPlanMode("equal");
    setShowPlanForm(true);
  }

  async function handleGenerateEqualPlan() {
    if (planTotalReais <= 0) {
      toast("Informe o valor total do contrato", "warning");
      return;
    }
    if (!planFirstDueDate) {
      toast("Informe a data do primeiro vencimento", "warning");
      return;
    }
    setGenerating(true);
    try {
      const input: GenerateInstallmentsInput = {
        paymentType: planPaymentType,
        totalValueCents: Math.round(planTotalReais * 100),
        installmentCount: planCount,
        firstDueDate: planFirstDueDate,
      };
      await generateInstallments(clientId, input, contract.id);
      toast("Parcelas geradas com sucesso");
      setShowPlanForm(false);
      changed();
    } catch (err) {
      toastError(err, "Não foi possível gerar as parcelas");
    } finally {
      setGenerating(false);
    }
  }

  function addCustomRow() {
    const last = customRows[customRows.length - 1];
    setCustomRows([...customRows, emptyCustomRow(last?.dueDate || todayIso())]);
  }

  function removeCustomRow(id: string) {
    setCustomRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  function updateCustomRow(id: string, patch: Partial<CustomRow>) {
    setCustomRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleCreateCustomPlan() {
    if (customRows.some((r) => !r.dueDate)) {
      toast("Informe o vencimento de cada parcela", "warning");
      return;
    }
    if (customRows.some((r) => r.amountReais <= 0)) {
      toast("Informe um valor maior que zero pra cada parcela", "warning");
      return;
    }
    setGenerating(true);
    try {
      await createCustomInstallmentPlan(
        clientId,
        {
          paymentType: customPaymentType,
          installments: customRows.map((r) => ({
            dueDate: r.dueDate,
            amountCents: Math.round(r.amountReais * 100),
          })),
        },
        contract.id,
      );
      toast("Parcelas geradas com sucesso");
      setShowPlanForm(false);
      changed();
    } catch (err) {
      toastError(err, "Não foi possível gerar as parcelas");
    } finally {
      setGenerating(false);
    }
  }

  async function handleTogglePaid(installmentId: string, currentlyPaid: boolean) {
    try {
      if (currentlyPaid) await markInstallmentUnpaid(clientId, installmentId);
      else await markInstallmentPaid(clientId, installmentId, todayIso());
      changed();
    } catch (err) {
      toastError(err, "Não foi possível atualizar a parcela");
    }
  }

  function startEditInstallment(installmentId: string, dueDate: string, amountCents: number) {
    setEditingInstallmentId(installmentId);
    setEditDueDate(dueDate);
    setEditAmountReais(amountCents / 100);
  }

  async function handleSaveInstallmentEdit(installmentId: string) {
    if (!editDueDate || editAmountReais <= 0) {
      toast("Informe vencimento e valor válidos", "warning");
      return;
    }
    setSavingInstallmentEdit(true);
    try {
      await updateInstallment(clientId, installmentId, {
        dueDate: editDueDate,
        amountCents: Math.round(editAmountReais * 100),
      });
      toast("Parcela atualizada");
      setEditingInstallmentId(null);
      changed();
    } catch (err) {
      toastError(err, "Não foi possível editar a parcela");
    } finally {
      setSavingInstallmentEdit(false);
    }
  }

  return (
    <div>
      <div className={styles.sectionHeaderRow}>
        <h4 className={styles.sectionTitle}>Parcelas</h4>
        {canManage && !showPlanForm && (
          <Button onClick={openPlanForm} disabled={hasPaidInstallment}>
            {installments && installments.length > 0 ? "Refazer parcelas" : "Definir pagamento"}
          </Button>
        )}
      </div>

      {canManage && hasPaidInstallment && !showPlanForm && (
        <p className={styles.mutedText}>
          Já existe parcela paga — não é possível refazer o plano de pagamento por aqui.
        </p>
      )}

      {showPlanForm && (
        <div className={styles.planForm}>
          <div className={styles.planModeToggle}>
            <button
              type="button"
              className={
                planMode === "equal"
                  ? `${styles.planModeBtn} ${styles.planModeBtnActive}`
                  : styles.planModeBtn
              }
              onClick={() => setPlanMode("equal")}
            >
              Parcelas iguais
            </button>
            <button
              type="button"
              className={
                planMode === "custom"
                  ? `${styles.planModeBtn} ${styles.planModeBtnActive}`
                  : styles.planModeBtn
              }
              onClick={() => setPlanMode("custom")}
            >
              Parcelas personalizadas
            </button>
          </div>

          {planMode === "equal" ? (
            <>
              <label className={styles.label}>
                Forma de pagamento
                <select
                  className={styles.editInput}
                  value={planPaymentType}
                  onChange={(e) => setPlanPaymentType(e.target.value as PaymentType)}
                >
                  <option value="vista">À vista</option>
                  <option value="mensal">Mensal</option>
                </select>
              </label>
              <label className={styles.label}>
                Valor total do contrato
                <CurrencyInput
                  className={styles.editInput}
                  value={planTotalReais}
                  onChange={setPlanTotalReais}
                />
              </label>
              {planPaymentType === "mensal" && (
                <label className={styles.label}>
                  Quantidade de parcelas
                  <input
                    className={styles.editInput}
                    type="number"
                    min={1}
                    max={120}
                    value={planCount}
                    onChange={(e) => setPlanCount(Number(e.target.value) || 1)}
                  />
                </label>
              )}
              <label className={styles.label}>
                Data do 1º vencimento
                <input
                  className={styles.editInput}
                  type="date"
                  value={planFirstDueDate}
                  onChange={(e) => setPlanFirstDueDate(e.target.value)}
                />
              </label>
              <div className={styles.formActions}>
                <Button onClick={() => setShowPlanForm(false)} disabled={generating}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void handleGenerateEqualPlan()}
                  disabled={generating}
                >
                  {generating ? "Gerando…" : "Gerar parcelas"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.mutedText}>
                Monte a lista parcela por parcela — cada uma com seu próprio valor e vencimento (ex.:
                entrada maior + parcelas menores depois).
              </p>
              <label className={styles.label}>
                Forma de pagamento
                <select
                  className={styles.editInput}
                  value={customPaymentType}
                  onChange={(e) => setCustomPaymentType(e.target.value as PaymentType)}
                >
                  <option value="vista">À vista</option>
                  <option value="mensal">Mensal</option>
                </select>
              </label>

              <div className={styles.customRows}>
                {customRows.map((row, index) => (
                  <div key={row.id} className={styles.customRow}>
                    <span className={styles.customRowSeq}>{index + 1}</span>
                    <input
                      className={styles.editInput}
                      type="date"
                      aria-label={`Vencimento da parcela ${index + 1}`}
                      value={row.dueDate}
                      onChange={(e) => updateCustomRow(row.id, { dueDate: e.target.value })}
                    />
                    <CurrencyInput
                      className={styles.editInput}
                      aria-label={`Valor da parcela ${index + 1}`}
                      value={row.amountReais}
                      onChange={(v) => updateCustomRow(row.id, { amountReais: v })}
                    />
                    <button
                      type="button"
                      className={styles.customRowRemove}
                      onClick={() => removeCustomRow(row.id)}
                      disabled={customRows.length === 1}
                      aria-label="Remover parcela"
                      title="Remover parcela"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <Button onClick={addCustomRow}>+ Adicionar parcela</Button>

              <div className={styles.customTotal}>
                Total: <strong>R$ {brl(customTotalReais)}</strong>
              </div>

              <div className={styles.formActions}>
                <Button onClick={() => setShowPlanForm(false)} disabled={generating}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void handleCreateCustomPlan()}
                  disabled={generating}
                >
                  {generating ? "Gerando…" : "Gerar parcelas"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {!showPlanForm && installments && installments.length > 0 && (
        <table className={styles.installmentsTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {installments.map((i) =>
              editingInstallmentId === i.id ? (
                <tr key={i.id}>
                  <td>{i.sequence}</td>
                  <td>
                    <input
                      className={styles.inlineEditInput}
                      type="date"
                      aria-label={`Vencimento da parcela ${i.sequence}`}
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                    />
                  </td>
                  <td>
                    <CurrencyInput
                      className={styles.inlineEditInput}
                      aria-label={`Valor da parcela ${i.sequence}`}
                      value={editAmountReais}
                      onChange={setEditAmountReais}
                    />
                  </td>
                  <td colSpan={2} className={styles.inlineEditActions}>
                    <Button
                      onClick={() => setEditingInstallmentId(null)}
                      disabled={savingInstallmentEdit}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => void handleSaveInstallmentEdit(i.id)}
                      disabled={savingInstallmentEdit}
                    >
                      {savingInstallmentEdit ? "Salvando…" : "Salvar"}
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={i.id}>
                  <td>{i.sequence}</td>
                  <td>{fmtDate(i.dueDate)}</td>
                  <td>R$ {brl(i.amountCents / 100)}</td>
                  <td>
                    <Badge
                      label={INSTALLMENT_STATUS_LABEL[i.status]}
                      color={STATUS_BADGE[i.status]?.color ?? "#999"}
                      bg={STATUS_BADGE[i.status]?.bg ?? "rgba(153,153,153,.14)"}
                    />
                  </td>
                  <td className={styles.installmentRowActions}>
                    {canManage && i.paidAt === null && (
                      <Button onClick={() => startEditInstallment(i.id, i.dueDate, i.amountCents)}>
                        Editar
                      </Button>
                    )}
                    {canManage && (
                      <Button onClick={() => void handleTogglePaid(i.id, i.paidAt !== null)}>
                        {i.paidAt !== null ? "Desmarcar" : "Marcar pago"}
                      </Button>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      {!showPlanForm && installments && installments.length === 0 && (
        <p className={styles.mutedText}>Nenhuma parcela gerada ainda.</p>
      )}
    </div>
  );
}
