import { useState } from "react";
import { usePipelines } from "../../hooks/usePipelines";
import { usePipelineActions } from "../../hooks/usePipelineActions";
import { useToast } from "../../hooks/useToast";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { EmptyState } from "../common/EmptyState";
import { reorderIds } from "../../utils/pipelineBoard";
import type { Pipeline, PipelineStage } from "../../types/pipeline";
import { SettingsCard } from "./SettingsCard";
import styles from "./Settings.module.css";

// Mesmo funil padrão semeado automaticamente pelo backend em todo pipeline
// NOVO (ver `CreatePipelineUseCase._DEFAULT_STAGES`) — só existe aqui como
// recuperação pra pipelines criados ANTES dessa mudança, que ficaram sem
// nenhum estágio (e por isso sem nenhuma forma de cadastrar lead).
const DEFAULT_STAGES: { label: string; color: string; isWon?: boolean; isLost?: boolean }[] = [
  { label: "Novo", color: "#4aa3ff" },
  { label: "Em contato", color: "#f5b13d" },
  { label: "Proposta", color: "#a78bfa" },
  { label: "Ganho", color: "#2ee66e", isWon: true },
  { label: "Perdido", color: "#9aa6b2", isLost: true },
];

/**
 * Pipelines e etapas. Mesmas operações e regras de antes (criar, renomear/cor, padrão, excluir,
 * etapas: criar/editar/reordenar/excluir); só a apresentação mudou: ações com texto, rótulos
 * visíveis, ajuda sobre o efeito de Ganho/Perdido e o impacto de cada exclusão. As recusas do
 * servidor (409: há leads) continuam sendo exibidas como toast.
 */
export function PipelinesSection() {
  const { data: pipelines, loading, error, reload } = usePipelines();
  const { create, update, delete: deletePipeline, setDefault, createStage, updateStage, deleteStage, reorderStages } =
    usePipelineActions();
  const { toast, toastError } = useToast();
  const [newName, setNewName] = useState("");
  // Etapa em edição — identidade é SEMPRE o UUID real (Etapa 1).
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [newStageFor, setNewStageFor] = useState<string | null>(null);
  const [newStageForm, setNewStageForm] = useState({ label: "", color: "#4aa3ff" });
  const [confirmDeleteStage, setConfirmDeleteStage] = useState<PipelineStage | null>(null);
  const [confirmDeletePipeline, setConfirmDeletePipeline] = useState<Pipeline | null>(null);
  const [stageForm, setStageForm] = useState({ label: "", color: "#4aa3ff", isWon: false, isLost: false });
  const [editingPipeline, setEditingPipeline] = useState<string | null>(null);
  const [pipelineForm, setPipelineForm] = useState({ name: "", color: "#4aa3ff" });

  async function handleCreatePipeline() {
    if (!newName.trim()) return;
    try {
      await create({ name: newName.trim(), color: "#4aa3ff" });
      setNewName("");
      toast("Pipeline criado");
      reload();
    } catch (err) {
      toastError(err, "Não foi possível criar o pipeline");
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefault(id);
      toast("Pipeline padrão atualizado");
      reload();
    } catch (err) {
      toastError(err, "Não foi possível definir o pipeline padrão");
    }
  }

  function startEditPipeline(pipeline: Pipeline) {
    setEditingPipeline(pipeline.id);
    setPipelineForm({ name: pipeline.name, color: pipeline.color });
  }

  async function handleSavePipeline() {
    if (!editingPipeline) return;
    try {
      await update(editingPipeline, pipelineForm);
      setEditingPipeline(null);
      toast("Pipeline atualizado");
      reload();
    } catch (err) {
      toastError(err, "Não foi possível atualizar o pipeline");
    }
  }

  async function handleCreateDefaultStages(pipelineId: string) {
    try {
      for (const stage of DEFAULT_STAGES) {
        // Sequencial (não Promise.all) de propósito: `order` no backend é
        // `len(estágios já existentes)` no momento da criação — em paralelo,
        // duas criações poderiam ler a mesma contagem e colidir na mesma ordem.
        await createStage(pipelineId, stage);
      }
      toast("Estágios padrão criados");
      reload();
    } catch (err) {
      toastError(err, "Não foi possível criar os estágios padrão");
    }
  }

  function startEditStage(stage: PipelineStage) {
    setEditingStageId(stage.id);
    setStageForm({ label: stage.label, color: stage.color, isWon: stage.isWon, isLost: stage.isLost });
  }

  async function handleSaveStage() {
    if (!editingStageId) return;
    try {
      await updateStage(editingStageId, { ...stageForm, label: stageForm.label.trim() });
      setEditingStageId(null);
      toast("Etapa atualizada");
      reload();
    } catch (err) {
      toastError(err, "Não foi possível atualizar a etapa");
    }
  }

  async function handleCreateStage(pipelineId: string) {
    if (!newStageForm.label.trim()) return;
    try {
      await createStage(pipelineId, { label: newStageForm.label.trim(), color: newStageForm.color });
      setNewStageForm({ label: "", color: "#4aa3ff" });
      setNewStageFor(null);
      toast("Etapa criada");
      reload();
    } catch (err) {
      toastError(err, "Não foi possível criar a etapa");
    }
  }

  async function handleDeleteStage(stage: PipelineStage): Promise<boolean> {
    try {
      await deleteStage(stage.id);
      setEditingStageId(null);
      toast("Etapa excluída");
      reload();
      return true;
    } catch (err) {
      // 409 = ainda há leads nesta etapa (mensagem do backend).
      toastError(err, "Não foi possível excluir a etapa");
      return false;
    }
  }

  async function handleMoveStage(pipeline: Pipeline, stage: PipelineStage, direction: -1 | 1) {
    const ids = pipeline.stages.map((st) => st.id);
    const neighbor = ids[ids.indexOf(stage.id) + direction];
    if (!neighbor) return;
    const next = reorderIds(ids, stage.id, neighbor);
    if (!next) return;
    try {
      await reorderStages(pipeline.id, next);
      reload();
    } catch (err) {
      toastError(err, "Não foi possível reordenar as etapas");
    }
  }

  async function handleDeletePipeline(pipeline: Pipeline): Promise<boolean> {
    try {
      await deletePipeline(pipeline.id);
      toast("Pipeline excluído");
      reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível excluir o pipeline");
      return false;
    }
  }

  return (
    <SettingsCard
      title="Pipelines e etapas"
      description="Cada pipeline é um funil de vendas. As etapas mostram por onde o lead passa; marque uma etapa como Ganho ou Perdido para encerrar a negociação. As alterações valem para toda a equipe assim que você salva."
      actions={
        <div className={styles.inlineForm}>
          <input
            className={styles.input}
            placeholder="Nome do novo pipeline…"
            aria-label="Nome do novo pipeline"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button variant="primary" onClick={() => void handleCreatePipeline()} disabled={!newName.trim()}>
            Adicionar
          </Button>
        </div>
      }
    >
      {error && (
        <EmptyState
          tone="error"
          title="Não foi possível carregar os pipelines"
          message={error.message}
          actions={[{ label: "Tentar de novo", onClick: reload }]}
        />
      )}
      {loading && !pipelines && <div className={styles.loading}>Carregando…</div>}
      {pipelines && pipelines.length > 0 && !pipelines.some((p) => p.isDefault) && (
        <p className={styles.warning} role="alert">
          Nenhum pipeline está marcado como padrão — os leads que chegam pelas integrações
          (site, formulários, n8n) não têm onde entrar. Use “Tornar padrão” em um deles.
        </p>
      )}

      <div className={styles.pipelineGrid}>
        {pipelines?.map((pipeline) => (
          <div key={pipeline.id} className={styles.pipelineCard}>
            {editingPipeline === pipeline.id ? (
              <div className={styles.pipelineEditForm}>
                <input
                  className={styles.colorInput}
                  type="color"
                  value={pipelineForm.color}
                  onChange={(e) => setPipelineForm((f) => ({ ...f, color: e.target.value }))}
                  aria-label="Cor do pipeline"
                />
                <input
                  className={styles.input}
                  aria-label="Nome do pipeline"
                  value={pipelineForm.name}
                  onChange={(e) => setPipelineForm((f) => ({ ...f, name: e.target.value }))}
                />
                <Button
                  variant="primary"
                  onClick={() => void handleSavePipeline()}
                  disabled={!pipelineForm.name.trim()}
                >
                  Salvar
                </Button>
                <Button onClick={() => setEditingPipeline(null)}>Cancelar</Button>
              </div>
            ) : (
              <div className={styles.pipelineHeader}>
                <span className={styles.pipelineDot} style={{ background: pipeline.color }} aria-hidden="true" />
                <span className={styles.pipelineName}>{pipeline.name}</span>
                <button
                  type="button"
                  className={styles.rowBtn}
                  onClick={() => startEditPipeline(pipeline)}
                  aria-label={`Editar pipeline ${pipeline.name}`}
                  title="Editar nome/cor"
                >
                  ✎ Editar
                </button>
                {pipeline.isDefault ? (
                  <Badge label="Padrão" color="var(--accent-soft)" bg="var(--accent-bg)" />
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.setDefaultBtn}
                      onClick={() => void handleSetDefault(pipeline.id)}
                    >
                      Tornar padrão
                    </button>
                    {pipelines.length > 1 && (
                      <button
                        type="button"
                        className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                        onClick={() => setConfirmDeletePipeline(pipeline)}
                        aria-label={`Excluir pipeline ${pipeline.name}`}
                        title="Excluir pipeline"
                      >
                        ✕ Excluir
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <div className={styles.stages}>
              {pipeline.stages.map((stage, index) =>
                editingStageId === stage.id ? (
                  <div key={stage.id} className={styles.stageEditForm}>
                    <input
                      className={styles.input}
                      aria-label="Nome da etapa"
                      value={stageForm.label}
                      onChange={(e) => setStageForm((f) => ({ ...f, label: e.target.value }))}
                    />
                    <input
                      className={styles.colorInput}
                      type="color"
                      value={stageForm.color}
                      onChange={(e) => setStageForm((f) => ({ ...f, color: e.target.value }))}
                      aria-label="Cor do estágio"
                    />
                    <label className={styles.stageFlagLabel}>
                      <input
                        type="checkbox"
                        checked={stageForm.isWon}
                        // Ganho e perda são exclusivos (o backend recusa os dois).
                        onChange={(e) =>
                          setStageForm((f) => ({
                            ...f,
                            isWon: e.target.checked,
                            isLost: e.target.checked ? false : f.isLost,
                          }))
                        }
                      />
                      Ganho
                    </label>
                    <label className={styles.stageFlagLabel}>
                      <input
                        type="checkbox"
                        checked={stageForm.isLost}
                        onChange={(e) =>
                          setStageForm((f) => ({
                            ...f,
                            isLost: e.target.checked,
                            isWon: e.target.checked ? false : f.isWon,
                          }))
                        }
                      />
                      Perdido
                    </label>
                    <Button
                      variant="primary"
                      onClick={() => void handleSaveStage()}
                      disabled={!stageForm.label.trim()}
                    >
                      Salvar
                    </Button>
                    <Button onClick={() => setEditingStageId(null)}>Cancelar</Button>
                    <Button
                      onClick={() => void handleMoveStage(pipeline, stage, -1)}
                      disabled={index === 0}
                      aria-label="Mover etapa para a esquerda"
                      title="Mover para antes"
                    >
                      ←
                    </Button>
                    <Button
                      onClick={() => void handleMoveStage(pipeline, stage, 1)}
                      disabled={index === pipeline.stages.length - 1}
                      aria-label="Mover etapa para a direita"
                      title="Mover para depois"
                    >
                      →
                    </Button>
                    <Button variant="danger" onClick={() => setConfirmDeleteStage(stage)}>
                      Excluir
                    </Button>
                    <p className={styles.help}>
                      Ganho e Perdido são exclusivos. Mover um lead para uma etapa Perdido pede confirmação.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    key={stage.id}
                    className={styles.stageChip}
                    onClick={() => startEditStage(stage)}
                    title="Clique para editar, reordenar ou excluir"
                  >
                    <span className={styles.stageDot} style={{ background: stage.color }} aria-hidden="true" />
                    {stage.label}
                    {stage.isWon ? " 🏆" : stage.isLost ? " ✕" : ""}
                  </button>
                ),
              )}
              {newStageFor === pipeline.id ? (
                <div className={styles.stageEditForm}>
                  <input
                    className={styles.input}
                    placeholder="Nome da etapa…"
                    aria-label="Nome da nova etapa"
                    value={newStageForm.label}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, label: e.target.value }))}
                    autoFocus
                  />
                  <input
                    className={styles.colorInput}
                    type="color"
                    value={newStageForm.color}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, color: e.target.value }))}
                    aria-label="Cor da etapa"
                  />
                  <Button
                    variant="primary"
                    onClick={() => void handleCreateStage(pipeline.id)}
                    disabled={!newStageForm.label.trim()}
                  >
                    Adicionar
                  </Button>
                  <Button onClick={() => setNewStageFor(null)}>Cancelar</Button>
                </div>
              ) : (
                <button type="button" className={styles.stageChip} onClick={() => setNewStageFor(pipeline.id)}>
                  + Etapa
                </button>
              )}
            </div>
            {pipeline.stages.length > 0 && (
              <p className={styles.help}>Clique em uma etapa para editar, reordenar ou excluir.</p>
            )}
            {pipeline.stages.length === 0 && (
              <div className={styles.noStages}>
                <p className={styles.noStagesText}>
                  Sem estágios — não é possível cadastrar lead neste pipeline ainda.
                </p>
                <Button variant="primary" onClick={() => void handleCreateDefaultStages(pipeline.id)}>
                  Criar estágios padrão
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {confirmDeleteStage && (
        <ConfirmDialog
          title="Excluir etapa?"
          message={`A etapa "${confirmDeleteStage.label}" será excluída. Só é possível excluir uma etapa sem leads — mova os leads antes. Os templates de mensagem de WhatsApp cadastrados para esta etapa também serão excluídos.`}
          onConfirm={() => handleDeleteStage(confirmDeleteStage)}
          onClose={() => setConfirmDeleteStage(null)}
        />
      )}
      {confirmDeletePipeline && (
        <ConfirmDialog
          title="Excluir pipeline?"
          message={`"${confirmDeletePipeline.name}" e as etapas dele serão excluídos. Só é possível excluir um pipeline sem leads.`}
          onConfirm={() => handleDeletePipeline(confirmDeletePipeline)}
          onClose={() => setConfirmDeletePipeline(null)}
        />
      )}
    </SettingsCard>
  );
}
