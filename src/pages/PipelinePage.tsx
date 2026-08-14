import { useState } from "react";
import { usePipelines } from "../hooks/usePipelines";
import { useLeads } from "../hooks/useLeads";
import { leadsService } from "../services/LeadsService";
import { EmptyState } from "../components/common/EmptyState";
import { Badge } from "../components/common/Badge";
import { LeadDrawer } from "../components/leads/LeadDrawer";
import { originOf } from "../constants/origins";
import { brl } from "../utils/currency";
import type { StageKey } from "../types/pipeline";
import type { Lead } from "../types/lead";
import styles from "./PipelinePage.module.css";

export function PipelinePage() {
  const { data: pipelines, loading: loadingPipelines, error: pipelineError } = usePipelines();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const pipeline = pipelines?.find((p) => p.id === selectedPipelineId) ?? pipelines?.[0];

  const { data, loading, error, reload } = useLeads({
    ...(pipeline ? { pipelineId: pipeline.id } : {}),
    page: 1,
    pageSize: 200,
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  async function handleDrop(stage: StageKey) {
    if (!dragId) return;
    const leadId = dragId;
    setDragId(null);
    await leadsService.move(leadId, stage);
    reload();
  }

  if (pipelineError) return <EmptyState title="Não foi possível carregar os pipelines" message={pipelineError.message} />;
  if (loadingPipelines || !pipeline) return <div className={styles.loading}>Carregando…</div>;

  const leads = data?.items ?? [];
  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Pipeline</h1>
          <p className={styles.pageSubtitle}>Arraste os cards entre as etapas</p>
        </div>
        {pipelines && pipelines.length > 1 && (
          <select
            className={styles.pipelineSelect}
            value={pipeline.id}
            onChange={(e) => setSelectedPipelineId(e.target.value)}
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <EmptyState title="Não foi possível carregar os leads" message={error.message} />}

      {!error && (
        <div className={styles.board}>
          {pipeline.stages.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.id);
            return (
              <div
                key={stage.id}
                className={styles.column}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void handleDrop(stage.id)}
              >
                <div className={styles.columnHeader}>
                  <span className={styles.columnDot} style={{ background: stage.color }} />
                  <span className={styles.columnLabel}>{stage.label}</span>
                  <span className={styles.columnCount}>{stageLeads.length}</span>
                </div>
                <div className={styles.cards}>
                  {stageLeads.map((lead) => (
                    <KanbanCard
                      key={lead.id}
                      lead={lead}
                      onDragStart={() => setDragId(lead.id)}
                      onClick={() => setSelectedLeadId(lead.id)}
                    />
                  ))}
                  {stageLeads.length === 0 && !loading && <div className={styles.empty}>Sem leads</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedLead && (
        <LeadDrawer lead={selectedLead} onClose={() => setSelectedLeadId(null)} onSaved={() => reload()} />
      )}
    </div>
  );
}

function KanbanCard({
  lead,
  onDragStart,
  onClick,
}: {
  lead: Lead;
  onDragStart: () => void;
  onClick: () => void;
}) {
  const origin = originOf(lead.origin);
  return (
    <div className={styles.card} draggable onDragStart={onDragStart} onClick={onClick}>
      <div className={styles.cardName}>{lead.name}</div>
      <div className={styles.cardCompany}>{lead.company}</div>
      <div className={styles.cardFooter}>
        <span className={styles.cardValue}>R$ {brl(lead.value)}</span>
        <Badge label={origin.label} color={origin.color} bg={origin.bg} />
      </div>
    </div>
  );
}
