import { useState } from "react";
import { Button } from "../common/Button";
import { useProspectLossReasonActions } from "../../hooks/useProspectLossReasonActions";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../types/common";
import type { ProspectLossReason } from "../../types/prospect";
// Reaproveita o CSS de `ManageStagesModal` de propósito — mesma estrutura
// visual (overlay/modal/lista com nome + excluir + campo de adicionar),
// não vale a pena duplicar um arquivo `.module.css` só pra isso.
import styles from "./ManageStagesModal.module.css";

export function ManageLossReasonsModal({
  reasons,
  onClose,
  onChanged,
}: {
  reasons: ProspectLossReason[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { create, delete: deleteReason } = useProspectLossReasonActions();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await create({ name: name.trim() });
      setName("");
      onChanged();
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 409
          ? err.message
          : "Não foi possível criar o motivo";
      toast(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(reason: ProspectLossReason) {
    setDeletingId(reason.id);
    setRowError(null);
    try {
      await deleteReason(reason.id);
      onChanged();
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 409
          ? err.message
          : "Não foi possível excluir esse motivo.";
      setRowError({ id: reason.id, message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Motivos de perda</h2>
        <p className={styles.modalSubtitle}>
          Lista usada ao mover um prospect pra um estágio "Perdido" — só é possível excluir um
          motivo que nenhum prospect esteja usando.
        </p>

        <div className={styles.list}>
          {reasons.map((reason) => (
            <div key={reason.id}>
              <div className={styles.row}>
                <span className={styles.name}>{reason.name}</span>
                <button
                  className={styles.deleteBtn}
                  type="button"
                  onClick={() => void handleDelete(reason)}
                  disabled={deletingId === reason.id}
                  aria-label={`Excluir motivo ${reason.name}`}
                >
                  {deletingId === reason.id ? "Excluindo…" : "Excluir"}
                </button>
              </div>
              {rowError?.id === reason.id && <p className={styles.errorNote}>{rowError.message}</p>}
            </div>
          ))}
          {reasons.length === 0 && <p className={styles.modalSubtitle}>Nenhum motivo cadastrado ainda.</p>}
        </div>

        <div className={styles.addRow}>
          <input
            className={styles.input}
            placeholder="Nome do novo motivo…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
          />
          <Button variant="primary" onClick={() => void handleCreate()} disabled={creating || !name.trim()}>
            Adicionar
          </Button>
        </div>

        <div className={styles.modalActions}>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}
