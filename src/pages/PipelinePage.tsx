import { useState } from "react";
import { usePipelines } from "../hooks/usePipelines";
import { usePipelineActions } from "../hooks/usePipelineActions";
import { useLeads } from "../hooks/useLeads";
import { useLeadActions } from "../hooks/useLeadActions";
import { useLeadMessageTemplates } from "../hooks/useLeadMessageTemplates";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "../components/common/EmptyState";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { PeriodFilter } from "../components/common/PeriodFilter";
import { LeadDrawer } from "../components/leads/LeadDrawer";
import { LeadImportModal } from "../components/leads/LeadImportModal";
import { WhatsappButton } from "../components/leads/WhatsappButton";
import { ProspectionBoard } from "../components/prospects/ProspectionBoard";
import { originOf } from "../constants/origins";
import { brl } from "../utils/currency";
import { EMPTY_PERIOD, type Period } from "../utils/periods";
import type { StageKey } from "../types/pipeline";
import type { Lead, LeadMessageTemplate } from "../types/lead";
import styles from "./PipelinePage.module.css";

type SourceFilter = "todos" | "ativo" | "passivo";

const PASSIVO_BADGE = { label: "Passivo", color: "#4aa3ff", bg: "rgba(74,163,255,.14)" };

const SOURCE_FILTER_LABEL: Record<SourceFilter, string> = {
  todos: "Todos",
  ativo: "Ativo (prospecção)",
  passivo: "Passivo (leads)",
};

export function PipelinePage() {
  // Ver DashboardPage.tsx — `isPlatformStaff` vem de `GET /auth/me`.
  const { user } = useAuth();
  const isSuperAdmin = user?.isPlatformStaff ?? false;
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("todos");
  const [period, setPeriod] = useState<Period>(EMPTY_PERIOD);
  const showPassivo = !isSuperAdmin || sourceFilter !== "ativo";
  const showAtivo = isSuperAdmin && sourceFilter !== "passivo";

  return (
    <div>
      {isSuperAdmin && (
        <div className={styles.sourceFilter}>
          {(["todos", "ativo", "passivo"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={
                sourceFilter === option
                  ? `${styles.sourceFilterBtn} ${styles.sourceFilterBtnActive}`
                  : styles.sourceFilterBtn
              }
              onClick={() => setSourceFilter(option)}
            >
              {SOURCE_FILTER_LABEL[option]}
            </button>
          ))}
        </div>
      )}

      <PeriodFilter value={period} onChange={setPeriod} />

      {showPassivo && <LeadsPipelineBoard taggedPassivo={isSuperAdmin} period={period} />}

      {showPassivo && showAtivo && <div className={styles.sourceDivider} />}

      {showAtivo && <ProspectionBoard period={period} />}
    </div>
  );
}

function LeadsPipelineBoard({ taggedPassivo, period }: { taggedPassivo: boolean; period: Period }) {
  const {
    data: pipelines,
    loading: loadingPipelines,
    error: pipelineError,
    reload: reloadPipelines,
  } = usePipelines();
  const { reorderStages } = usePipelineActions();
  const { move, exportCsv } = useLeadActions();
  const { data: templates } = useLeadMessageTemplates();
  const { toast } = useToast();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const pipeline = pipelines?.find((p) => p.id === selectedPipelineId) ?? pipelines?.[0];

  const { data, loading, error, reload } = useLeads({
    ...(pipeline ? { pipelineId: pipeline.id } : {}),
    ...period,
    page: 1,
    pageSize: 200,
  });
  const [dragId, setDragId] = useState<string | null>(null);
  // Arrastar uma COLUNA (reordenar estágios) é diferente de arrastar um
  // CARD (mover lead de estágio) — estado separado, mesmo padrão de
  // `ProspectionBoard.tsx`.
  const [dragColumnId, setDragColumnId] = useState<StageKey | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleDrop(targetStage: StageKey) {
    if (dragColumnId) {
      const draggedStageId = dragColumnId;
      setDragColumnId(null);
      if (!pipeline || draggedStageId === targetStage) return;
      const ids = pipeline.stages.map((s) => s.id);
      const fromIndex = ids.indexOf(draggedStageId);
      const toIndex = ids.indexOf(targetStage);
      if (fromIndex === -1 || toIndex === -1) return;
      ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, draggedStageId);
      try {
        await reorderStages(pipeline.id, ids);
        reloadPipelines();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não foi possível reordenar os estágios");
      }
      return;
    }
    if (!dragId) return;
    const leadId = dragId;
    setDragId(null);
    await move(leadId, targetStage);
    reload();
  }

  function handleExport() {
    void (async () => {
      try {
        const csv = await exportCsv();
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "leads.csv";
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não foi possível exportar.");
      }
    })();
  }

  if (pipelineError) {
    return <EmptyState title="Não foi possível carregar os pipelines" message={pipelineError.message} />;
  }
  if (loadingPipelines) return <div className={styles.loading}>Carregando…</div>;
  if (!pipeline) {
    return (
      <EmptyState
        title="Nenhum pipeline cadastrado ainda"
        message="Crie o primeiro pipeline em Configurações para começar a usar o quadro."
      />
    );
  }

  const leads = data?.items ?? [];
  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            {taggedPassivo && <Badge {...PASSIVO_BADGE} />} Pipeline
          </h1>
          <p className={styles.pageSubtitle}>Arraste os cards entre as etapas</p>
        </div>
        <div className={styles.toolbar}>
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
          <Button onClick={() => setImporting(true)}>Importar CSV</Button>
          <Button onClick={handleExport}>Exportar CSV</Button>
        </div>
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
                <div
                  className={styles.columnHeader}
                  draggable
                  onDragStart={() => setDragColumnId(stage.id)}
                  title="Arraste pra reordenar os estágios"
                >
                  <span className={styles.columnDot} style={{ background: stage.color }} />
                  <span className={styles.columnLabel}>{stage.label}</span>
                  <span className={styles.columnCount}>{stageLeads.length}</span>
                </div>
                <div className={styles.cards}>
                  {stageLeads.map((lead) => (
                    <KanbanCard
                      key={lead.id}
                      lead={lead}
                      templates={templates ?? []}
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
        <LeadDrawer
          lead={selectedLead}
          templates={templates ?? []}
          onClose={() => setSelectedLeadId(null)}
          onSaved={() => reload()}
        />
      )}

      {importing && pipeline && (
        <LeadImportModal
          pipelineId={pipeline.id}
          stages={pipeline.stages}
          defaultStageId={pipeline.stages[0]?.id ?? "novo"}
          onClose={() => setImporting(false)}
          onImported={() => reload()}
        />
      )}
    </div>
  );
}

function KanbanCard({
  lead,
  templates,
  onDragStart,
  onClick,
}: {
  lead: Lead;
  templates: LeadMessageTemplate[];
  onDragStart: () => void;
  onClick: () => void;
}) {
  const origin = originOf(lead.origin);
  return (
    <div className={styles.card} draggable onDragStart={onDragStart} onClick={onClick}>
      <div className={styles.cardName}>{lead.name}</div>
      <div className={styles.cardCompany}>{lead.company}</div>
      {lead.lastComment && (
        // `title` = tooltip nativo com o texto inteiro no hover; o texto
        // visível já vem truncado por CSS (`.cardComment`, ellipsis).
        <div className={styles.cardComment} title={lead.lastComment.text}>
          💬 {lead.lastComment.text}
        </div>
      )}
      <div className={styles.cardFooter}>
        <span className={styles.cardValue}>R$ {brl(lead.value)}</span>
        <Badge label={origin.label} color={origin.color} bg={origin.bg} />
      </div>
      <WhatsappButton lead={lead} templates={templates} size="small" />
    </div>
  );
}
