import { useState } from "react";
import { usePipelines } from "../hooks/usePipelines";
import { pipelinesService } from "../services/PipelinesService";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { useToast } from "../hooks/useToast";
import { mockTags } from "../mock/tags";
import { ORIGIN } from "../constants/origins";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const { data: pipelines, loading, error, reload } = usePipelines();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");

  async function handleCreatePipeline() {
    if (!newName.trim()) return;
    await pipelinesService.create({ name: newName.trim(), color: "#4aa3ff" });
    setNewName("");
    toast("Pipeline criado");
    reload();
  }

  async function handleSetDefault(id: string) {
    await pipelinesService.setDefault(id);
    toast("Pipeline padrão atualizado");
    reload();
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
              <div className={styles.pipelineHeader}>
                <span className={styles.pipelineDot} style={{ background: pipeline.color }} />
                <span className={styles.pipelineName}>{pipeline.name}</span>
                {pipeline.isDefault ? (
                  <Badge label="Padrão" color="#2ee66e" bg="rgba(46,230,110,.14)" />
                ) : (
                  <button className={styles.setDefaultBtn} onClick={() => void handleSetDefault(pipeline.id)}>
                    Tornar padrão
                  </button>
                )}
              </div>
              <div className={styles.stages}>
                {pipeline.stages.map((stage) => (
                  <span key={stage.id} className={styles.stageChip} style={{ color: stage.color }}>
                    {stage.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tags</h2>
        <div className={styles.chipRow}>
          {mockTags.map((tag) => (
            <Badge key={tag.id} label={tag.label} color={tag.color} bg={tag.bg} />
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
    </div>
  );
}
