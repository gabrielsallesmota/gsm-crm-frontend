import { useState } from "react";
import type { ClientContract, UpdateContractInput } from "../../types/client";
import { CONTRACT_STATUS_LABEL, PAYMENT_TYPE_LABEL } from "../../types/client";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { InstallmentsPanel } from "./InstallmentsPanel";
import { ContractForm } from "./ContractForm";
import { alertPreview } from "../../utils/contracts";
import { useClientActions } from "../../hooks/useClientActions";
import { useToast } from "../../hooks/useToast";
import type { RenewalDefault } from "../../hooks/useRenewalDefault";
import { brl } from "../../utils/currency";
import { fmtDate, renewalUrgency, toIsoDate } from "../../utils/renewal";
import local from "./Contracts.module.css";

const STATUS_TONE: Record<ClientContract["status"], { color: string; bg: string }> = {
  active: { color: "var(--tone-green-text)", bg: "var(--tone-green-bg)" },
  renewed: { color: "var(--tone-blue-text)", bg: "var(--tone-blue-bg)" },
  ended: { color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
};

/**
 * Um contrato/ciclo do cliente: dados, data de renovação com o aviso, ações (editar, encerrar,
 * excluir) e as parcelas dele. Só admin e gestor alteram (`canManage`).
 */
export function ContractCard({
  clientId,
  contract,
  canManage,
  tenantDefault,
  onChanged,
}: {
  clientId: string;
  contract: ClientContract;
  canManage: boolean;
  tenantDefault: RenewalDefault | null;
  /** Contrato ou parcelas mudaram — recarrega a lista de contratos e a de clientes. */
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const { updateContract, endContract, deleteContract } = useClientActions();
  const [editing, setEditing] = useState(false);
  const [showInstallments, setShowInstallments] = useState(false);
  const [confirm, setConfirm] = useState<"end" | "delete" | null>(null);
  const today = toIsoDate(new Date());
  const urgency =
    contract.status === "active" && contract.renewalDate
      ? renewalUrgency(contract.renewalDate, today)
      : null;
  const label = contract.title || `Contrato ${contract.cycleNumber}`;
  const preview =
    contract.status === "active"
      ? alertPreview(
          contract.renewalDate ?? "",
          contract.renewalAlertMode,
          contract.renewalAlertValue,
          tenantDefault,
        )
      : null;

  async function save(input: UpdateContractInput) {
    try {
      await updateContract(clientId, contract.id, input);
      toast("Contrato atualizado");
      setEditing(false);
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível salvar o contrato");
    }
  }

  async function end(): Promise<boolean> {
    try {
      await endContract(clientId, contract.id);
      toast("Contrato encerrado");
      onChanged();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível encerrar o contrato");
      return false;
    }
  }

  async function remove(): Promise<boolean> {
    try {
      await deleteContract(clientId, contract.id);
      toast("Contrato excluído");
      onChanged();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível excluir o contrato");
      return false;
    }
  }

  return (
    <li className={local.card} aria-label={label}>
      <div className={local.cardHead}>
        <div>
          <h4 className={local.cardTitle}>{label}</h4>
          <div className={local.badges}>
            <Badge
              label={CONTRACT_STATUS_LABEL[contract.status]}
              color={STATUS_TONE[contract.status].color}
              bg={STATUS_TONE[contract.status].bg}
            />
            {urgency === "overdue" && (
              <Badge label="Renovação vencida" color="var(--tone-red-text)" bg="var(--tone-red-bg)" />
            )}
            {urgency === "soon" && (
              <Badge label="Renova em breve" color="var(--tone-amber-text)" bg="var(--tone-amber-bg)" />
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <ContractForm
          contract={contract}
          tenantDefault={tenantDefault}
          submitLabel="Salvar contrato"
          onCancel={() => setEditing(false)}
          onSubmit={save}
        />
      ) : (
        <>
          <dl className={local.facts}>
            <div>
              <dt>Valor</dt>
              <dd>{contract.valueCents ? `R$ ${brl(contract.valueCents / 100)}` : "—"}</dd>
            </div>
            <div>
              <dt>Pagamento</dt>
              <dd>
                {contract.paymentType ? PAYMENT_TYPE_LABEL[contract.paymentType] : "—"}
                {contract.installmentCount && contract.installmentCount > 1
                  ? ` · ${contract.installmentCount}x`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Início</dt>
              <dd>{fmtDate(contract.startDate)}</dd>
            </div>
            <div>
              <dt>Fim</dt>
              <dd>{fmtDate(contract.endDate)}</dd>
            </div>
            <div>
              <dt>Renovação</dt>
              <dd>{fmtDate(contract.renewalDate)}</dd>
            </div>
          </dl>
          {preview && <p className={local.alertNote}>{preview}</p>}
          {contract.notes && <p className={local.alertNote}>{contract.notes}</p>}

          <div className={local.actions}>
            <Button onClick={() => setShowInstallments((v) => !v)} aria-expanded={showInstallments}>
              {showInstallments ? "Ocultar parcelas" : "Ver parcelas"}
            </Button>
            {canManage && (
              <>
                <Button onClick={() => setEditing(true)}>Editar contrato</Button>
                {contract.status === "active" && (
                  <Button onClick={() => setConfirm("end")}>Encerrar</Button>
                )}
                <Button variant="danger" onClick={() => setConfirm("delete")}>
                  Excluir
                </Button>
              </>
            )}
          </div>
        </>
      )}

      {showInstallments && !editing && (
        <div className={local.installments}>
          <InstallmentsPanel
            clientId={clientId}
            contract={contract}
            canManage={canManage}
            onChanged={onChanged}
          />
        </div>
      )}

      {confirm === "end" && (
        <ConfirmDialog
          title="Encerrar este contrato?"
          message="O cliente não renovou. O contrato e as parcelas continuam no histórico, mas o aviso de renovação deixa de valer."
          confirmLabel="Encerrar contrato"
          onConfirm={end}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === "delete" && (
        <ConfirmDialog
          title="Excluir este contrato?"
          message="As parcelas dele também serão apagadas. Se houver parcela paga, o sistema não deixa excluir — nesse caso, encerre o contrato."
          confirmLabel="Excluir contrato"
          onConfirm={remove}
          onClose={() => setConfirm(null)}
        />
      )}
    </li>
  );
}
