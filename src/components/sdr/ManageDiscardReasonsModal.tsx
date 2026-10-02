import { useState } from "react";
import { Button } from "../common/Button";
import { useToast } from "../../hooks/useToast";
import { sdrService } from "../../services/SdrService";
import { ApiError } from "../../types/common";
import type { SdrDiscardReason } from "../../types/sdr";
// Mesma estrutura visual de "Motivos de perda" da prospecção
// (`ManageLossReasonsModal`) — reaproveita o CSS de lá.
import styles from "../prospects/ManageStagesModal.module.css";

/** Cadastro dos motivos de descarte de candidatos do SDR (lista usada ao
 * descartar um candidato, sozinho ou em lote). */
export function ManageDiscardReasonsModal({
  reasons,
  onClose,
  onChanged,
}: {
  reasons: SdrDiscardReason[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  function apiMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiError && (err.status === 409 || err.status === 403)) return err.message;
    return fallback;
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await sdrService.createDiscardReason({ name: name.trim() });
      setName("");
      onChanged();
    } catch (err) {
      toast(apiMessage(err, "Não foi possível criar o motivo"), "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(reason: SdrDiscardReason) {
    setDeletingId(reason.id);
    setRowError(null);
    try {
      await sdrService.deleteDiscardReason(reason.id);
      onChanged();
    } catch (err) {
      setRowError({ id: reason.id, message: apiMessage(err, "Não foi possível excluir esse motivo.") });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Motivos de descarte</h2>
        <p className={styles.modalSubtitle}>
          Usados ao descartar um candidato do SDR (sozinho ou em lote). Exemplos: "Sem telefone",
          "Fora do perfil", "Já tem site bom", "Fechado".
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
          {reasons.length === 0 && (
            <p className={styles.modalSubtitle}>Nenhum motivo cadastrado ainda.</p>
          )}
        </div>

        <div className={styles.addRow}>
          <input
            className={styles.input}
            placeholder="Nome do novo motivo…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
          />
          <Button
            variant="primary"
            onClick={() => void handleCreate()}
            disabled={creating || !name.trim()}
          >
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
