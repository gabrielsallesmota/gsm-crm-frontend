import { useState } from "react";
import { useProspectStages } from "../../hooks/useProspectStages";
import { useProspectStageActions } from "../../hooks/useProspectStageActions";
import { useToast } from "../../hooks/useToast";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import type { ProspectStage } from "../../types/prospect";
import { SettingsCard } from "./SettingsCard";
import styles from "./Settings.module.css";

const EMPTY_FORM = { name: "", color: "#4aa3ff", isWon: false, isLost: false, asksTargetDate: false };

/** Estágios da Prospecção — ferramenta INTERNA da GSM (a página só monta esta seção para staff). */
export function ProspectStagesSection() {
  const {
    data: prospectStages,
    notImplemented: prospectStagesNotImplemented,
    reload: reloadProspectStages,
  } = useProspectStages();
  const {
    create: createProspectStage,
    update: updateProspectStage,
    delete: deleteProspectStage,
  } = useProspectStageActions();
  const { toast, toastError } = useToast();
  const [newProspectStage, setNewProspectStage] = useState(EMPTY_FORM);
  const [editingProspectStage, setEditingProspectStage] = useState<string | null>(null);
  const [prospectStageForm, setProspectStageForm] = useState(EMPTY_FORM);

  async function handleCreateProspectStage() {
    if (!newProspectStage.name.trim()) return;
    try {
      await createProspectStage(newProspectStage);
      setNewProspectStage(EMPTY_FORM);
      toast("Estágio de prospecção criado");
      reloadProspectStages();
    } catch (err) {
      toastError(err, "Não foi possível criar o estágio de prospecção");
    }
  }

  function startEditProspectStage(stage: ProspectStage) {
    setEditingProspectStage(stage.id);
    setProspectStageForm({
      name: stage.name,
      color: stage.color,
      isWon: stage.isWon,
      isLost: stage.isLost,
      asksTargetDate: stage.asksTargetDate,
    });
  }

  async function handleSaveProspectStage() {
    if (!editingProspectStage) return;
    try {
      await updateProspectStage(editingProspectStage, prospectStageForm);
      setEditingProspectStage(null);
      toast("Estágio de prospecção atualizado");
      reloadProspectStages();
    } catch (err) {
      toastError(err, "Não foi possível atualizar o estágio de prospecção");
    }
  }

  async function handleDeleteProspectStage(id: string) {
    try {
      await deleteProspectStage(id);
      toast("Estágio de prospecção removido");
      reloadProspectStages();
    } catch (err) {
      toastError(err, "Não foi possível remover o estágio de prospecção");
    }
  }

  return (
    <SettingsCard
      title="Prospecção — Estágios"
      description="Funil interno da GSM para prospecção. Não aparece para os clientes."
      internal
      actions={
        <div className={styles.inlineForm}>
          <input
            className={styles.input}
            placeholder="Nome do novo estágio…"
            aria-label="Nome do novo estágio de prospecção"
            value={newProspectStage.name}
            onChange={(e) => setNewProspectStage((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className={styles.colorInput}
            type="color"
            value={newProspectStage.color}
            onChange={(e) => setNewProspectStage((f) => ({ ...f, color: e.target.value }))}
            aria-label="Cor do estágio"
          />
          <label className={styles.stageFlagLabel}>
            <input
              type="checkbox"
              checked={newProspectStage.isWon}
              onChange={(e) => setNewProspectStage((f) => ({ ...f, isWon: e.target.checked }))}
            />
            Ganho
          </label>
          <label className={styles.stageFlagLabel}>
            <input
              type="checkbox"
              checked={newProspectStage.isLost}
              onChange={(e) => setNewProspectStage((f) => ({ ...f, isLost: e.target.checked }))}
            />
            Perdido
          </label>
          <label
            className={styles.stageFlagLabel}
            title="Ao mover um prospect pra este estágio, pergunta quando retomar contato"
          >
            <input
              type="checkbox"
              checked={newProspectStage.asksTargetDate}
              onChange={(e) => setNewProspectStage((f) => ({ ...f, asksTargetDate: e.target.checked }))}
            />
            Pede data alvo ao mover
          </label>
          <Button
            variant="primary"
            onClick={() => void handleCreateProspectStage()}
            disabled={!newProspectStage.name.trim()}
          >
            Adicionar
          </Button>
        </div>
      }
    >
      {prospectStagesNotImplemented ? (
        <EmptyState
          title="Não disponível no modo Demonstração"
          message="Prospecção GSM é uma área interna, sem dados fictícios para mostrar aqui."
        />
      ) : (
        <div className={styles.stages}>
          {prospectStages?.map((stage) =>
            editingProspectStage === stage.id ? (
              <div key={stage.id} className={styles.stageEditForm}>
                <input
                  className={styles.input}
                  aria-label="Nome do estágio de prospecção"
                  value={prospectStageForm.name}
                  onChange={(e) => setProspectStageForm((f) => ({ ...f, name: e.target.value }))}
                />
                <input
                  className={styles.colorInput}
                  type="color"
                  value={prospectStageForm.color}
                  onChange={(e) => setProspectStageForm((f) => ({ ...f, color: e.target.value }))}
                  aria-label="Cor do estágio"
                />
                <label className={styles.stageFlagLabel}>
                  <input
                    type="checkbox"
                    checked={prospectStageForm.isWon}
                    onChange={(e) => setProspectStageForm((f) => ({ ...f, isWon: e.target.checked }))}
                  />
                  Ganho
                </label>
                <label className={styles.stageFlagLabel}>
                  <input
                    type="checkbox"
                    checked={prospectStageForm.isLost}
                    onChange={(e) => setProspectStageForm((f) => ({ ...f, isLost: e.target.checked }))}
                  />
                  Perdido
                </label>
                <label
                  className={styles.stageFlagLabel}
                  title="Ao mover um prospect pra este estágio, pergunta quando retomar contato"
                >
                  <input
                    type="checkbox"
                    checked={prospectStageForm.asksTargetDate}
                    onChange={(e) =>
                      setProspectStageForm((f) => ({ ...f, asksTargetDate: e.target.checked }))
                    }
                  />
                  Pede data alvo ao mover
                </label>
                <Button
                  variant="primary"
                  onClick={() => void handleSaveProspectStage()}
                  disabled={!prospectStageForm.name.trim()}
                >
                  Salvar
                </Button>
                <Button onClick={() => setEditingProspectStage(null)}>Cancelar</Button>
                <Button variant="danger" onClick={() => void handleDeleteProspectStage(stage.id)}>
                  Excluir
                </Button>
              </div>
            ) : (
              <button
                type="button"
                key={stage.id}
                className={styles.stageChip}
                onClick={() => startEditProspectStage(stage)}
                title="Clique para editar"
              >
                <span className={styles.stageDot} style={{ background: stage.color }} aria-hidden="true" />
                {stage.name}
              </button>
            ),
          )}
        </div>
      )}
    </SettingsCard>
  );
}
