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
import { ORIGIN } from "../constants/origins";
import { hexToRgba } from "../utils/colors";
import type { Pipeline, PipelineStage, StageKey } from "../types/pipeline";
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
  const { create, update, setDefault, createStage, updateStage } = usePipelineActions();
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
  const isSuperAdmin = user?.isPlatformStaff ?? false;
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState("#4aa3ff");
  const [editingStage, setEditingStage] = useState<{ pipelineId: string; stageKey: StageKey } | null>(
    null,
  );
  const [stageForm, setStageForm] = useState({ label: "", color: "#4aa3ff", isWon: false, isLost: false });
  const [editingPipeline, setEditingPipeline] = useState<string | null>(null);
  const [pipelineForm, setPipelineForm] = useState({ name: "", color: "#4aa3ff" });
  const [newProspectStage, setNewProspectStage] = useState({
    name: "",
    color: "#4aa3ff",
    isWon: false,
    isLost: false,
  });
  const [editingProspectStage, setEditingProspectStage] = useState<string | null>(null);
  const [prospectStageForm, setProspectStageForm] = useState({
    name: "",
    color: "#4aa3ff",
    isWon: false,
    isLost: false,
  });

  async function handleCreatePipeline() {
    if (!newName.trim()) return;
    try {
      await create({ name: newName.trim(), color: "#4aa3ff" });
      setNewName("");
      toast("Pipeline criado");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível criar o pipeline");
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefault(id);
      toast("Pipeline padrão atualizado");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível definir o pipeline padrão");
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
      toast(err instanceof Error ? err.message : "Não foi possível atualizar o pipeline");
    }
  }

  async function handleCreateProspectStage() {
    if (!newProspectStage.name.trim()) return;
    try {
      await createProspectStage(newProspectStage);
      setNewProspectStage({ name: "", color: "#4aa3ff", isWon: false, isLost: false });
      toast("Estágio de prospecção criado");
      reloadProspectStages();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível criar o estágio de prospecção");
    }
  }

  function startEditProspectStage(stage: ProspectStage) {
    setEditingProspectStage(stage.id);
    setProspectStageForm({
      name: stage.name,
      color: stage.color,
      isWon: stage.isWon,
      isLost: stage.isLost,
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
      toast(err instanceof Error ? err.message : "Não foi possível atualizar o estágio de prospecção");
    }
  }

  async function handleDeleteProspectStage(id: string) {
    try {
      await deleteProspectStage(id);
      toast("Estágio de prospecção removido");
      reloadProspectStages();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível remover o estágio de prospecção");
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
      toast(err instanceof Error ? err.message : "Não foi possível criar os estágios padrão");
    }
  }

  function startEditStage(pipelineId: string, stage: PipelineStage) {
    setEditingStage({ pipelineId, stageKey: stage.id });
    setStageForm({ label: stage.label, color: stage.color, isWon: stage.isWon, isLost: stage.isLost });
  }

  async function handleSaveStage() {
    if (!editingStage) return;
    try {
      await updateStage(editingStage.pipelineId, editingStage.stageKey, stageForm);
      setEditingStage(null);
      toast("Estágio atualizado");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível atualizar o estágio");
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
      toast(err instanceof Error ? err.message : "Não foi possível criar a tag");
    }
  }

  async function handleDeleteTag(id: string) {
    try {
      await deleteTag(id);
      toast("Tag removida");
      reloadTags();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível remover a tag");
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Configurações</h1>
      <p className={styles.pageSubtitle}>Pipelines, estágios, tags e origens</p>

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
                    <button
                      type="button"
                      className={styles.setDefaultBtn}
                      onClick={() => void handleSetDefault(pipeline.id)}
                    >
                      Tornar padrão
                    </button>
                  )}
                </div>
              )}
              <div className={styles.stages}>
                {pipeline.stages.map((stage) =>
                  editingStage?.pipelineId === pipeline.id && editingStage.stageKey === stage.id ? (
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
                          onChange={(e) => setStageForm((f) => ({ ...f, isWon: e.target.checked }))}
                        />
                        Ganho
                      </label>
                      <label className={styles.stageFlagLabel}>
                        <input
                          type="checkbox"
                          checked={stageForm.isLost}
                          onChange={(e) => setStageForm((f) => ({ ...f, isLost: e.target.checked }))}
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
                      <Button onClick={() => setEditingStage(null)}>Cancelar</Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      key={stage.id}
                      className={styles.stageChip}
                      style={{ color: stage.color }}
                      onClick={() => startEditStage(pipeline.id, stage)}
                      title="Clique para editar"
                    >
                      {stage.label}
                    </button>
                  ),
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
                    style={{ color: stage.color }}
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
