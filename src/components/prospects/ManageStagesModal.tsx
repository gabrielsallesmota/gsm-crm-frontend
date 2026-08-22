import { useState } from "react";
import { Button } from "../common/Button";
import { useProspectStageActions } from "../../hooks/useProspectStageActions";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../types/common";
import type { ProspectStage } from "../../types/prospect";
import styles from "./ManageStagesModal.module.css";

const COLOR_PRESETS = [
  "#4aa3ff",
  "#a78bfa",
  "#f5a623",
  "#e879f9",
  "#f59e0b",
  "#2ee66e",
  "#f43f5e",
  "#525866",
];

export function ManageStagesModal({
  stages,
  onClose,
  onChanged,
}: {
  stages: ProspectStage[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { create, delete: deleteStage } = useProspectStageActions();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(COLOR_PRESETS[0] ?? "#4aa3ff");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await create({ name: name.trim(), color });
      setName("");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível criar o estágio");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(stage: ProspectStage) {
    setDeletingId(stage.id);
    setRowError(null);
    try {
      await deleteStage(stage.id);
      onChanged();
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 409
          ? err.message
          : "Não foi possível excluir esse estágio.";
      setRowError({ id: stage.id, message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Estágios da prospecção</h2>
        <p className={styles.modalSubtitle}>
          Só é possível excluir um estágio vazio — mova os prospects antes.
        </p>

        <div className={styles.list}>
          {stages.map((stage) => (
            <div key={stage.id}>
              <div className={styles.row}>
                <span className={styles.dot} style={{ background: stage.color }} />
                <span className={styles.name}>{stage.name}</span>
                <button
                  className={styles.deleteBtn}
                  type="button"
                  onClick={() => void handleDelete(stage)}
                  disabled={deletingId === stage.id}
                  aria-label={`Excluir estágio ${stage.name}`}
                >
                  {deletingId === stage.id ? "Excluindo…" : "Excluir"}
                </button>
              </div>
              {rowError?.id === stage.id && <p className={styles.errorNote}>{rowError.message}</p>}
            </div>
          ))}
        </div>

        <div className={styles.colorSwatches}>
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`${styles.swatch} ${color === preset ? styles.swatchSelected : ""}`}
              style={{ background: preset }}
              onClick={() => setColor(preset)}
              aria-label={`Cor ${preset}`}
            />
          ))}
        </div>
        <div className={styles.addRow} style={{ marginTop: 10 }}>
          <input
            className={styles.input}
            placeholder="Nome do novo estágio…"
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
