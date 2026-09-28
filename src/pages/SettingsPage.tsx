import { useState } from "react";
import { usePipelines } from "../hooks/usePipelines";
import { usePipelineActions } from "../hooks/usePipelineActions";
import { useTags } from "../hooks/useTags";
import { useTagActions } from "../hooks/useTagActions";
import { useProspectStages } from "../hooks/useProspectStages";
import { useProspectStageActions } from "../hooks/useProspectStageActions";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { MessageTemplatesSettings } from "../components/prospects/MessageTemplatesSettings";
import { LeadMessageTemplatesSettings } from "../components/leads/LeadMessageTemplatesSettings";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";
import { can } from "../auth/permissions";
import { ORIGIN } from "../constants/origins";
import { hexToRgba, readableTextColor } from "../utils/colors";
import type { Pipeline, PipelineStage } from "../types/pipeline";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { reorderIds } from "../utils/pipelineBoard";
import type { ProspectStage } from "../types/prospect";
import styles from "./SettingsPage.module.css";

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

export function SettingsPage() {
  const { data: pipelines, loading, error, reload } = usePipelines();
  const {
    create,
    update,
    delete: deletePipeline,
    setDefault,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  } = usePipelineActions();
  const { data: tags, error: tagsError, reload: reloadTags } = useTags();
  const { create: createTag, delete: deleteTag } = useTagActions();
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
  // Ver DashboardPage.tsx — `isPlatformStaff` vem de `GET /auth/me`.
  const { user } = useAuth();
  const isSuperAdmin = can(user, "platform.internal");
  const { toast, toastError } = useToast();
  const [newName, setNewName] = useState("");
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState("#4aa3ff");
  // Etapa em edição — identidade é SEMPRE o UUID real (Etapa 1).
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [newStageFor, setNewStageFor] = useState<string | null>(null);
  const [newStageForm, setNewStageForm] = useState({ label: "", color: "#4aa3ff" });
  const [confirmDeleteStage, setConfirmDeleteStage] = useState<PipelineStage | null>(null);
  const [confirmDeletePipeline, setConfirmDeletePipeline] = useState<Pipeline | null>(null);
  const [stageForm, setStageForm] = useState({ label: "", color: "#4aa3ff", isWon: false, isLost: false });
  const [editingPipeline, setEditingPipeline] = useState<string | null>(null);
  const [pipelineForm, setPipelineForm] = useState({ name: "", color: "#4aa3ff" });
  const [newProspectStage, setNewProspectStage] = useState({
    name: "",
    color: "#4aa3ff",
    isWon: false,
    isLost: false,
    asksTargetDate: false,
  });
  const [editingProspectStage, setEditingProspectStage] = useState<string | null>(null);
  const [prospectStageForm, setProspectStageForm] = useState({
    name: "",
    color: "#4aa3ff",
    isWon: false,
    isLost: false,
    asksTargetDate: false,
  });

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

  async function handleCreateProspectStage() {
    if (!newProspectStage.name.trim()) return;
    try {
      await createProspectStage(newProspectStage);
      setNewProspectStage({
        name: "",
        color: "#4aa3ff",
        isWon: false,
        isLost: false,
        asksTargetDate: false,
      });
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

  async function handleCreateTag() {
    if (!newTagLabel.trim()) return;
    try {
      await createTag({ label: newTagLabel.trim(), color: newTagColor, bg: hexToRgba(newTagColor, 0.14) });
      setNewTagLabel("");
      toast("Tag criada");
      reloadTags();
    } catch (err) {
      toastError(err, "Não foi possível criar a tag");
    }
  }

  async function handleDeleteTag(id: string) {
    try {
      await deleteTag(id);
      toast("Tag removida");
      reloadTags();
    } catch (err) {
      toastError(err, "Não foi possível remover a tag");
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Configurações</h1>
      <p className={styles.pageSubtitle}>Pipelines, etapas, tags e origens</p>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Pipelines</h2>
          <div className={styles.inlineForm}>
            <input
              className={styles.input}
              placeholder="Nome do novo pipeline…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button variant="primary" onClick={() => void handleCreatePipeline()} disabled={!newName.trim()}>
              Adicionar
            </Button>
          </div>
        </div>

        {error && <EmptyState title="Não foi possível carregar os pipelines" message={error.message} />}
        {loading && !pipelines && <div className={styles.loading}>Carregando…</div>}

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
                  <span className={styles.pipelineDot} style={{ background: pipeline.color }} />
                  <span className={styles.pipelineName}>{pipeline.name}</span>
                  <button
                    type="button"
                    className={styles.editIconBtn}
                    onClick={() => startEditPipeline(pipeline)}
                    aria-label={`Editar pipeline ${pipeline.name}`}
                    title="Editar nome/cor"
                  >
                    ✎
                  </button>
                  {pipeline.isDefault ? (
                    <Badge label="Padrão" color="#2ee66e" bg="rgba(46,230,110,.14)" />
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.setDefaultBtn}
                        onClick={() => void handleSetDefault(pipeline.id)}
                      >
                        Tornar padrão
                      </button>
                      <button
                        type="button"
                        className={styles.editIconBtn}
                        onClick={() => setConfirmDeletePipeline(pipeline)}
                        aria-label={`Excluir pipeline ${pipeline.name}`}
                        title="Excluir pipeline"
                      >
                        ✕
                      </button>
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
                    </div>
                  ) : (
                    <button
                      type="button"
                      key={stage.id}
                      className={styles.stageChip}
                      style={{ color: readableTextColor(stage.color) }}
                      onClick={() => startEditStage(stage)}
                      title="Clique para editar, reordenar ou excluir"
                    >
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
                  <button
                    type="button"
                    className={styles.stageChip}
                    onClick={() => setNewStageFor(pipeline.id)}
                  >
                    + Etapa
                  </button>
                )}
              </div>
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
      </section>

      {confirmDeleteStage && (
        <ConfirmDialog
          title="Excluir etapa?"
          message={`A etapa "${confirmDeleteStage.label}" será excluída. Só é possível excluir uma etapa sem leads — mova os leads antes.`}
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

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Tags</h2>
          <div className={styles.inlineForm}>
            <input
              className={styles.input}
              placeholder="Nome da nova tag…"
              value={newTagLabel}
              onChange={(e) => setNewTagLabel(e.target.value)}
            />
            <input
              className={styles.colorInput}
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              aria-label="Cor da tag"
            />
            <Button variant="primary" onClick={() => void handleCreateTag()} disabled={!newTagLabel.trim()}>
              Adicionar
            </Button>
          </div>
        </div>

        {tagsError && <EmptyState title="Não foi possível carregar as tags" message={tagsError.message} />}

        <div className={styles.chipRow}>
          {tags?.map((tag) => (
            <span key={tag.id} className={styles.tagChip}>
              <Badge label={tag.label} color={tag.color} bg={tag.bg} />
              <button
                type="button"
                className={styles.tagDeleteBtn}
                onClick={() => void handleDeleteTag(tag.id)}
                aria-label={`Remover tag ${tag.label}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Origens</h2>
        <div className={styles.chipRow}>
          {Object.values(ORIGIN).map((origin) => (
            <span key={origin.label} className={styles.originChip} style={{ color: origin.color, background: origin.bg }}>
              {origin.icon} {origin.label}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pipeline — mensagens de WhatsApp</h2>
        <LeadMessageTemplatesSettings />
      </section>

      {isSuperAdmin && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Prospecção — Estágios</h2>
            <div className={styles.inlineForm}>
              <input
                className={styles.input}
                placeholder="Nome do novo estágio…"
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
              <label className={styles.stageFlagLabel} title="Ao mover um prospect pra este estágio, pergunta quando retomar contato">
                <input
                  type="checkbox"
                  checked={newProspectStage.asksTargetDate}
                  onChange={(e) =>
                    setNewProspectStage((f) => ({ ...f, asksTargetDate: e.target.checked }))
                  }
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
          </div>

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
                      value={prospectStageForm.name}
                      onChange={(e) =>
                        setProspectStageForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                    <input
                      className={styles.colorInput}
                      type="color"
                      value={prospectStageForm.color}
                      onChange={(e) =>
                        setProspectStageForm((f) => ({ ...f, color: e.target.value }))
                      }
                      aria-label="Cor do estágio"
                    />
                    <label className={styles.stageFlagLabel}>
                      <input
                        type="checkbox"
                        checked={prospectStageForm.isWon}
                        onChange={(e) =>
                          setProspectStageForm((f) => ({ ...f, isWon: e.target.checked }))
                        }
                      />
                      Ganho
                    </label>
                    <label className={styles.stageFlagLabel}>
                      <input
                        type="checkbox"
                        checked={prospectStageForm.isLost}
                        onChange={(e) =>
                          setProspectStageForm((f) => ({ ...f, isLost: e.target.checked }))
                        }
                      />
                      Perdido
                    </label>
                    <label className={styles.stageFlagLabel} title="Ao mover um prospect pra este estágio, pergunta quando retomar contato">
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
                    <Button
                      variant="danger"
                      onClick={() => void handleDeleteProspectStage(stage.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    key={stage.id}
                    className={styles.stageChip}
                    style={{ color: readableTextColor(stage.color) }}
                    onClick={() => startEditProspectStage(stage)}
                    title="Clique para editar"
                  >
                    {stage.name}
                  </button>
                ),
              )}
            </div>
          )}
        </section>
      )}

      {isSuperAdmin && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Prospecção — mensagens de WhatsApp</h2>
          <MessageTemplatesSettings />
        </section>
      )}
    </div>
  );
}
