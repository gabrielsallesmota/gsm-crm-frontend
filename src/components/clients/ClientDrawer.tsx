import { useRef, useState } from "react";
import type { Client, GenerateInstallmentsInput, PaymentType } from "../../types/client";
import { CLIENT_SOURCE_LABEL, INSTALLMENT_STATUS_LABEL, PAYMENT_TYPE_LABEL } from "../../types/client";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { EmptyState } from "../common/EmptyState";
import { useClientActions } from "../../hooks/useClientActions";
import { useClientInstallments } from "../../hooks/useClientInstallments";
import { useToast } from "../../hooks/useToast";
import { brl } from "../../utils/currency";
import styles from "./ClientDrawer.module.css";

type FormState = ReturnType<typeof fromClient>;
type PlanMode = "equal" | "custom";

function fromClient(client: Client) {
  return {
    companyName: client.companyName,
    phone: client.phone,
    email: client.email,
    city: client.city,
    niche: client.niche,
    notes: client.notes,
    // Fallback pra "hoje": `closedAt` é campo novo no backend — se a API
    // ainda não foi atualizada (deploy de frontend/backend independentes),
    // evita um input de data controlado virar não-controlado com "".
    closedAt: client.closedAt || todayIso(),
  };
}

/** "YYYY-MM-DD" → "DD/MM/AAAA" sem depender de fuso (evitar `new Date(iso)`
 * puro, que interpreta a data como UTC meia-noite e pode "voltar um dia"
 * em fusos negativos como o do Brasil). `undefined`/vazio devolve "—" em
 * vez de estourar — `closed_at` é um campo novo no backend, então uma
 * janela de deploy com o backend ainda desatualizado (frontend/backend
 * publicados por pipelines independentes, sem coordenação) não pode
 * derrubar a tela inteira. */
function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
  pago: { color: "#2ee66e", bg: "rgba(46,230,110,.14)" },
  atrasado: { color: "#ff5c5c", bg: "rgba(255,92,92,.14)" },
  pendente: { color: "#f5a623", bg: "rgba(245,166,35,.14)" },
};

export function ClientDrawer({
  client,
  onClose,
  onSaved,
  onDeleted,
  onReload,
}: {
  client: Client;
  onClose: () => void;
  /** Cliente foi editado direto (dados cadastrais, contrato) — o objeto
   * novo já vem completo do backend, pode substituir o da lista sem
   * recarregar tudo. */
  onSaved?: (client: Client) => void;
  onDeleted?: () => void;
  /** Algo mudou que NÃO devolve um `Client` pronto (parcelas geradas/
   * marcadas/editadas), mas afeta campos calculados que a lista mostra
   * (`nextDueDate`/`hasOverdueInstallment`) — pede pra página recarregar. */
  onReload?: () => void;
}) {
  const { toast } = useToast();
  const {
    update,
    delete: deleteClient,
    generateInstallments,
    createCustomInstallmentPlan,
    updateInstallment,
    markInstallmentPaid,
    markInstallmentUnpaid,
    uploadContract,
    downloadContract,
    deleteContract,
  } = useClientActions();
  const { data: installments, reload: reloadInstallments } = useClientInstallments(client.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contractBusy, setContractBusy] = useState(false);
  const [form, setForm] = useState<FormState>(() => fromClient(client));

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planMode, setPlanMode] = useState<PlanMode>("equal");
  const [generating, setGenerating] = useState(false);

  // Modo "parcelas iguais" — quantidade + valor total + 1º vencimento,
  // divide tudo igual (comportamento original).
  const [planPaymentType, setPlanPaymentType] = useState<PaymentType>(client.paymentType ?? "vista");
  const [planTotalReais, setPlanTotalReais] = useState(
    client.totalValueCents ? client.totalValueCents / 100 : 0,
  );
  const [planCount, setPlanCount] = useState(client.installmentCount ?? 1);
  const [planFirstDueDate, setPlanFirstDueDate] = useState(todayIso());

  // Modo "parcelas personalizadas" — cada parcela com seu próprio valor e
  // vencimento (ex.: entrada maior + parcelas menores depois). Pedido
  // explícito do usuário: "realmente precisa ter opção de parcela dinâmica".
  const [customPaymentType, setCustomPaymentType] = useState<PaymentType>("mensal");
  const [customRows, setCustomRows] = useState<CustomRow[]>([emptyCustomRow(todayIso())]);
  const customTotalReais = customRows.reduce((sum, row) => sum + (row.amountReais || 0), 0);

  // Edição pontual de UMA parcela já existente (valor/vencimento) — não
  // precisa refazer a ficha inteira pra corrigir uma parcela.
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editDueDate, setEditDueDate] = useState("");
  const [editAmountReais, setEditAmountReais] = useState(0);
  const [savingInstallmentEdit, setSavingInstallmentEdit] = useState(false);

  function startEdit() {
    setForm(fromClient(client));
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await update(client.id, form);
      toast("Cliente atualizado com sucesso");
      setEditing(false);
      onSaved?.(updated);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar as alterações");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteClient(client.id);
      toast("Cliente removido");
      onDeleted?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível remover o cliente");
      setDeleting(false);
    }
  }

  async function handleUploadFile(file: File) {
    setUploading(true);
    try {
      const updated = await uploadContract(client.id, file);
      toast("Contrato enviado com sucesso");
      onSaved?.(updated);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível enviar o contrato");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDownload() {
    setContractBusy(true);
    try {
      const blob = await downloadContract(client.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = client.contractFileName ?? "contrato.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível baixar o contrato");
    } finally {
      setContractBusy(false);
    }
  }

  async function handleDeleteContract() {
    setContractBusy(true);
    try {
      const updated = await deleteContract(client.id);
      toast("Contrato removido");
      onSaved?.(updated);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível remover o contrato");
    } finally {
      setContractBusy(false);
    }
  }

  function openPlanForm() {
    // Reabre sempre limpo — evita misturar resíduo de uma tentativa
    // anterior (ex.: trocou de modo e voltou) com o plano que já existe.
    setPlanPaymentType(client.paymentType ?? "vista");
    setPlanTotalReais(client.totalValueCents ? client.totalValueCents / 100 : 0);
    setPlanCount(client.installmentCount ?? 1);
    setPlanFirstDueDate(todayIso());
    setCustomPaymentType("mensal");
    setCustomRows([emptyCustomRow(todayIso())]);
    setPlanMode("equal");
    setShowPlanForm(true);
  }

  async function handleGenerateEqualPlan() {
    if (planTotalReais <= 0) {
      toast("Informe o valor total do contrato");
      return;
    }
    if (!planFirstDueDate) {
      toast("Informe a data do primeiro vencimento");
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
      await generateInstallments(client.id, input);
      toast("Parcelas geradas com sucesso");
      setShowPlanForm(false);
      reloadInstallments();
      onReload?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível gerar as parcelas");
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
      toast("Informe o vencimento de cada parcela");
      return;
    }
    if (customRows.some((r) => r.amountReais <= 0)) {
      toast("Informe um valor maior que zero pra cada parcela");
      return;
    }
    setGenerating(true);
    try {
      await createCustomInstallmentPlan(client.id, {
        paymentType: customPaymentType,
        installments: customRows.map((r) => ({
          dueDate: r.dueDate,
          amountCents: Math.round(r.amountReais * 100),
        })),
      });
      toast("Parcelas geradas com sucesso");
      setShowPlanForm(false);
      reloadInstallments();
      onReload?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível gerar as parcelas");
    } finally {
      setGenerating(false);
    }
  }

  async function handleTogglePaid(installmentId: string, currentlyPaid: boolean) {
    try {
      if (currentlyPaid) {
        await markInstallmentUnpaid(client.id, installmentId);
      } else {
        await markInstallmentPaid(client.id, installmentId, todayIso());
      }
      reloadInstallments();
      onReload?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível atualizar a parcela");
    }
  }

  function startEditInstallment(installmentId: string, dueDate: string, amountCents: number) {
    setEditingInstallmentId(installmentId);
    setEditDueDate(dueDate);
    setEditAmountReais(amountCents / 100);
  }

  async function handleSaveInstallmentEdit(installmentId: string) {
    if (!editDueDate || editAmountReais <= 0) {
      toast("Informe vencimento e valor válidos");
      return;
    }
    setSavingInstallmentEdit(true);
    try {
      await updateInstallment(client.id, installmentId, {
        dueDate: editDueDate,
        amountCents: Math.round(editAmountReais * 100),
      });
      toast("Parcela atualizada");
      setEditingInstallmentId(null);
      reloadInstallments();
      onReload?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível editar a parcela");
    } finally {
      setSavingInstallmentEdit(false);
    }
  }

  const hasPaidInstallment = (installments ?? []).some((i) => i.paidAt !== null);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Fechar">
          ✕
        </button>

        <div className={styles.header}>
          <div>
            {editing ? (
              <input
                className={styles.editInput}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            ) : (
              <h2 className={styles.name}>{client.companyName}</h2>
            )}
            <div className={styles.badges}>
              <Badge label={CLIENT_SOURCE_LABEL[client.source]} color="#4aa3ff" bg="rgba(74,163,255,.14)" />
              {client.paymentType && (
                <Badge label={PAYMENT_TYPE_LABEL[client.paymentType]} color="#a780ff" bg="rgba(167,128,255,.14)" />
              )}
              {client.hasOverdueInstallment && (
                <Badge label="Parcela atrasada" color="#ff5c5c" bg="rgba(255,92,92,.14)" />
              )}
            </div>
          </div>
          {!editing && (
            <Button className={styles.editToggle} onClick={startEdit}>
              Editar
            </Button>
          )}
        </div>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Dados do cliente</h3>
          {editing ? (
            <>
              <input
                className={styles.editInput}
                placeholder="Telefone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <input
                className={styles.editInput}
                placeholder="E-mail"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                className={styles.editInput}
                placeholder="Cidade"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <input
                className={styles.editInput}
                placeholder="Nicho"
                value={form.niche}
                onChange={(e) => setForm({ ...form, niche: e.target.value })}
              />
              <label className={styles.label}>
                Data de fechamento
                <input
                  className={styles.editInput}
                  type="date"
                  value={form.closedAt}
                  onChange={(e) => setForm({ ...form, closedAt: e.target.value })}
                />
              </label>
              <textarea
                className={styles.editTextarea}
                placeholder="Observações"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <div className={styles.formActions}>
                <Button onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </>
          ) : (
            <dl className={styles.fieldList}>
              <div className={styles.field}>
                <dt>Telefone</dt>
                <dd>{client.phone || "—"}</dd>
              </div>
              <div className={styles.field}>
                <dt>E-mail</dt>
                <dd>{client.email || "—"}</dd>
              </div>
              <div className={styles.field}>
                <dt>Cidade</dt>
                <dd>{client.city || "—"}</dd>
              </div>
              <div className={styles.field}>
                <dt>Nicho</dt>
                <dd>{client.niche || "—"}</dd>
              </div>
              <div className={styles.field}>
                <dt>Data de fechamento</dt>
                <dd>{fmtDate(client.closedAt)}</dd>
              </div>
              {client.notes && (
                <div className={styles.field}>
                  <dt>Observações</dt>
                  <dd>{client.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Contrato assinado</h3>
          {client.contractFileName ? (
            <div className={styles.contractRow}>
              <span className={styles.contractName}>📄 {client.contractFileName}</span>
              <div className={styles.contractActions}>
                <Button onClick={() => void handleDownload()} disabled={contractBusy}>
                  Baixar
                </Button>
                <Button variant="danger" onClick={() => void handleDeleteContract()} disabled={contractBusy}>
                  Remover
                </Button>
              </div>
            </div>
          ) : (
            <p className={styles.mutedText}>Nenhum contrato anexado ainda.</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className={styles.fileInput}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUploadFile(file);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Enviando…" : client.contractFileName ? "Substituir contrato (PDF)" : "Anexar contrato (PDF)"}
          </Button>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <h3 className={styles.sectionTitle}>Pagamento</h3>
            {!showPlanForm && (
              <Button onClick={openPlanForm} disabled={hasPaidInstallment}>
                {installments && installments.length > 0 ? "Refazer parcelas" : "Definir pagamento"}
              </Button>
            )}
          </div>

          {hasPaidInstallment && !showPlanForm && (
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
                    <CurrencyInput className={styles.editInput} value={planTotalReais} onChange={setPlanTotalReais} />
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
                    <Button variant="primary" onClick={() => void handleGenerateEqualPlan()} disabled={generating}>
                      {generating ? "Gerando…" : "Gerar parcelas"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.mutedText}>
                    Monte a lista parcela por parcela — cada uma com seu próprio valor e vencimento
                    (ex.: entrada maior + parcelas menores depois).
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
                          value={row.dueDate}
                          onChange={(e) => updateCustomRow(row.id, { dueDate: e.target.value })}
                        />
                        <CurrencyInput
                          className={styles.editInput}
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
                    <Button variant="primary" onClick={() => void handleCreateCustomPlan()} disabled={generating}>
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
                  <th></th>
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
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                        />
                      </td>
                      <td>
                        <CurrencyInput
                          className={styles.inlineEditInput}
                          value={editAmountReais}
                          onChange={setEditAmountReais}
                        />
                      </td>
                      <td colSpan={2} className={styles.inlineEditActions}>
                        <Button onClick={() => setEditingInstallmentId(null)} disabled={savingInstallmentEdit}>
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
                        {i.paidAt === null && (
                          <Button onClick={() => startEditInstallment(i.id, i.dueDate, i.amountCents)}>
                            Editar
                          </Button>
                        )}
                        <Button onClick={() => void handleTogglePaid(i.id, i.paidAt !== null)}>
                          {i.paidAt !== null ? "Desmarcar" : "Marcar pago"}
                        </Button>
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
        </section>

        <section className={styles.dangerZone}>
          {!confirmingDelete ? (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Remover cliente
            </Button>
          ) : (
            <div className={styles.confirmBox}>
              <EmptyState
                title="Remover este cliente?"
                message="Isso apaga também as parcelas e o contrato anexado. Não afeta o prospect/lead de origem."
              />
              <div className={styles.formActions}>
                <Button onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
                  {deleting ? "Removendo…" : "Confirmar remoção"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
