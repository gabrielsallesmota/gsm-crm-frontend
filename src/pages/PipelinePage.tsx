import { lazy, Suspense, useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePipelines } from "../hooks/usePipelines";
import { usePipelineBoard, type BoardFilter } from "../hooks/usePipelineBoard";
import { useLeadActions } from "../hooks/useLeadActions";
import { useLeadMessageTemplates } from "../hooks/useLeadMessageTemplates";
import { useTeamDirectory } from "../hooks/useTeamDirectory";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";
import { can } from "../auth/permissions";
import { EmptyState } from "../components/common/EmptyState";
import { SkeletonRows } from "../components/common/Skeleton";
import { usePageTitle } from "../hooks/usePageTitle";
import { useMarkOnboardingVisit } from "../hooks/useOnboarding";
import { ROUTES } from "../constants/routes";
import { PeriodFilter } from "../components/common/PeriodFilter";
import { LeadDrawer } from "../components/leads/LeadDrawer";
import { LeadImportModal } from "../components/leads/LeadImportModal";
import { KanbanColumn } from "../components/pipeline/KanbanColumn";
import { LeadCard } from "../components/pipeline/LeadCard";
import { PipelineFilters } from "../components/pipeline/PipelineFilters";
import { PipelineHeader } from "../components/pipeline/PipelineHeader";
import { StageTabs } from "../components/pipeline/StageTabs";
// Prospecção é funil INTERNO da GSM (só platform staff) — chunk próprio,
// nunca baixado por usuário de tenant. Não é controle de acesso: o backend
// recusa /prospects para quem não é staff.
const ProspectionBoard = lazy(() =>
  import("../components/prospects/ProspectionBoard").then((m) => ({ default: m.ProspectionBoard })),
);
import { useIsMobile } from "../hooks/useMediaQuery";
import { usePipelineDrag } from "../hooks/usePipelineDrag";
import { useStageReorder } from "../hooks/useStageReorder";
import { serverSortFor, type BoardSortOption } from "../utils/boardSort";
import { findLead } from "../utils/pipelineBoard";
import { boardSummary } from "../utils/pipelineView";
import { EMPTY_PERIOD, type Period } from "../utils/periods";
import type { PipelineStage } from "../types/pipeline";
import styles from "./PipelinePage.module.css";

type SourceFilter = "todos" | "ativo" | "passivo";

const SOURCE_FILTER_LABEL: Record<SourceFilter, string> = {
  todos: "Todos",
  ativo: "Ativo (prospecção)",
  passivo: "Passivo (leads)",
};

export function PipelinePage() {
  // Ver DashboardPage.tsx — `isPlatformStaff` vem de `GET /auth/me`.
  const { user } = useAuth();
  const isSuperAdmin = can(user, "platform.internal");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("todos");
  const [period, setPeriod] = useState<Period>(EMPTY_PERIOD);
  const showPassivo = !isSuperAdmin || sourceFilter !== "ativo";
  const showAtivo = isSuperAdmin && sourceFilter !== "passivo";
  usePageTitle("Pipeline");
  useMarkOnboardingVisit("pipeline");

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
              aria-pressed={sourceFilter === option}
            >
              {SOURCE_FILTER_LABEL[option]}
            </button>
          ))}
        </div>
      )}

      {/* O período do quadro de leads mora nos filtros dele ("Criados em"); só a Prospecção sozinha
          (staff com "Ativo") precisa do controle no topo da página. */}
      {!showPassivo && <PeriodFilter value={period} onChange={setPeriod} />}

      {showPassivo && <LeadsPipelineBoard taggedPassivo={isSuperAdmin} period={period} onPeriod={setPeriod} />}

      {showPassivo && showAtivo && <div className={styles.sourceDivider} />}

      {showAtivo && (
        <Suspense fallback={null}>
          <ProspectionBoard period={period} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * Quadro sobre as etapas REAIS do pipeline (Etapa 1): quantas, com que
 * nomes, cores e ordem o cliente configurou — sem funil fixo. Cada coluna é
 * paginada no backend ("Carregar mais"), o contador é o total real, o
 * movimento é otimista com rollback e existe alternativa ao arrastar
 * (seletor no card e na ficha do lead).
 *
 * Redesign (Prompt 06): esta função só orquestra estado e regras; a apresentação está em
 * `components/pipeline/*` (cabeçalho, filtros, coluna, cartão, abas de etapa).
 */
function LeadsPipelineBoard({
  taggedPassivo,
  period,
  onPeriod,
}: {
  taggedPassivo: boolean;
  period: Period;
  onPeriod: (period: Period) => void;
}) {
  const {
    data: pipelines,
    loading: loadingPipelines,
    error: pipelineError,
    reload: reloadPipelines,
  } = usePipelines();
  const { exportCsv } = useLeadActions();
  const { data: templates } = useLeadMessageTemplates();
  const { data: team } = useTeamDirectory();
  const { toast, toastError } = useToast();
  const { user } = useAuth();
  // Reordenar estágios é configuração (ADMIN/GESTOR no backend) — vendedor
  // não vê a alça de arrastar coluna. Ver auth/permissions.ts.
  const canReorderStages = can(user, "pipeline.reorder");
  const canFilterByOwner = can(user, "leads.viewAll");
  const isMobile = useIsMobile();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const pipeline =
    pipelines?.find((p) => p.id === selectedPipelineId) ??
    pipelines?.find((p) => p.isDefault) ??
    pipelines?.[0];
  const stages = pipeline?.stages ?? [];

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  // "" = todos; "__none__" = sem responsável; senão o id do dono.
  const [ownerFilter, setOwnerFilter] = useState("");
  // Ordenação GLOBAL: vai para o servidor junto com os demais filtros (PIP-02).
  const [sortOption, setSortOption] = useState<BoardSortOption>("none");
  const filter: BoardFilter = {
    ...period,
    ...serverSortFor(sortOption),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(ownerFilter === "__none__" ? { unassigned: true } : ownerFilter ? { ownerId: ownerFilter } : {}),
  };
  const board = usePipelineBoard(pipeline?.id ?? null, stages, filter);

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  // Mobile: uma etapa por vez (null = a primeira).
  const [mobileStageId, setMobileStageId] = useState<string | null>(null);
  // `?importar=1` (vindo do Dashboard/onboarding) já abre a importação.
  const [searchParams, setSearchParams] = useSearchParams();
  const [importing, setImporting] = useState(searchParams.get("importar") === "1");
  const navigate = useNavigate();
  function closeImport() {
    setImporting(false);
    if (searchParams.has("importar")) {
      searchParams.delete("importar");
      setSearchParams(searchParams, { replace: true });
    }
  }

  const ownerNames = new Map((team ?? []).map((m) => [m.id, m.name]));

  async function moveLead(leadId: string, stage: PipelineStage) {
    const result = await board.move(leadId, stage.id);
    if (result.ok) {
      if (stage.isWon) toast("Negócio marcado como ganho 🏆");
      else if (stage.isLost) toast("Negócio marcado como perdido", "info");
    } else if (result.reason === "busy") {
      toast("Aguarde: este lead ainda está sendo movido.", "warning");
    } else if (result.reason === "error") {
      toastError(result.error, "Não foi possível mover o lead — ele voltou para a etapa anterior.");
    }
  }

  // PIP-04: reordenar etapas (botões do cabeçalho e arrastar) com foco devolvido ao botão certo.
  const { moveStageBy, dropStage } = useStageReorder(pipeline, stages, reloadPipelines);
  const drag = usePipelineDrag({ moveLead, dropStage, stages });

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
        toastError(err, "Não foi possível exportar.");
      }
    })();
  }

  const openLead = useCallback((id: string) => setSelectedLeadId(id), []);

  const canConfigure = can(user, "settings.manage");
  const configureAction = canConfigure
    ? [{ label: "Abrir Configurações", to: ROUTES.configuracoes }]
    : [];

  if (pipelineError) {
    return (
      <EmptyState
        tone="error"
        title="Não foi possível carregar o pipeline"
        message={pipelineError.message}
        actions={[{ label: "Tentar de novo", onClick: reloadPipelines }]}
      />
    );
  }
  if (loadingPipelines && !pipelines) return <SkeletonRows rows={5} label="Carregando o pipeline" />;
  if (!pipeline) {
    return (
      <EmptyState
        title="Nenhum pipeline cadastrado ainda"
        message={
          canConfigure
            ? "O pipeline é o caminho da venda (ex.: Novo → Em contato → Proposta → Ganho). Crie o primeiro em Configurações."
            : "Seu administrador ainda não configurou o funil de vendas. Fale com ele para começar."
        }
        actions={configureAction}
      />
    );
  }
  if (stages.length === 0) {
    return (
      <EmptyState
        title="Este pipeline ainda não tem etapas"
        message={
          canConfigure
            ? "Cadastre as etapas do funil (ex.: Novo, Em contato, Proposta, Ganho, Perdido) em Configurações."
            : "Seu administrador ainda não cadastrou as etapas deste funil."
        }
        actions={configureAction}
      />
    );
  }

  const selectedLead = selectedLeadId ? findLead(board.board, selectedLeadId) : null;
  const firstOpenStage = stages.find((s) => !s.isWon && !s.isLost) ?? stages[0];
  // Quadro sem nenhum lead (e sem filtro): orientar em vez de N colunas
  // "Sem leads" (Etapa 4).
  const columns = stages.map((s) => board.board[s.id]);
  const boardLoaded = columns.every((c) => c && c.page > 0 && !c.loading);
  const boardEmpty =
    boardLoaded &&
    columns.every((c) => (c?.total ?? 0) === 0) &&
    !debouncedSearch &&
    !ownerFilter &&
    JSON.stringify(period) === JSON.stringify(EMPTY_PERIOD);
  const summary = boardSummary(stages, board.board);
  const mobileActiveId = stages.some((s) => s.id === mobileStageId) ? (mobileStageId as string) : stages[0]!.id;
  const draggedLead = drag.dragId ? findLead(board.board, drag.dragId) : null;
  // Celular: uma etapa por vez (abas + só a coluna ativa no DOM). Demais larguras: todas as colunas.
  const visibleStages = isMobile ? stages.filter((s) => s.id === mobileActiveId) : stages;

  return (
    <div className={styles.page}>
      <PipelineHeader
        pipeline={pipeline}
        pipelines={pipelines ?? []}
        onPipelineChange={setSelectedPipelineId}
        summary={summary}
        taggedPassivo={taggedPassivo}
        onImport={() => setImporting(true)}
        onExport={handleExport}
      />

      <PipelineFilters
        search={search}
        onSearch={setSearch}
        owner={ownerFilter}
        onOwner={setOwnerFilter}
        owners={team ?? undefined}
        canFilterByOwner={canFilterByOwner}
        sort={sortOption}
        onSort={setSortOption}
        period={period}
        onPeriod={onPeriod}
      />

      {boardEmpty && (
        <div className={styles.boardEmpty}>
          <EmptyState
            compact
            title="Seu funil ainda está vazio"
            message="Cadastre um lead ou importe uma planilha (CSV do Excel/Google Planilhas). Os leads aparecem na primeira etapa e você os move conforme a venda avança."
            actions={[
              { label: "Adicionar lead", onClick: () => navigate(`${ROUTES.leads}?novo=1`) },
              { label: "Importar planilha", onClick: () => setImporting(true) },
            ]}
          />
        </div>
      )}

      {isMobile && (
        <StageTabs stages={stages} board={board.board} activeId={mobileActiveId} onSelect={setMobileStageId} />
      )}

      <div className={styles.board}>
        {visibleStages.map((stage) => {
          const column = board.board[stage.id];
          const index = stages.indexOf(stage);
          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              column={column}
              isFirst={index === 0}
              isLast={index === stages.length - 1}
              canReorder={canReorderStages}
              mobileActive={stage.id === mobileActiveId}
              cardOver={!!draggedLead && drag.overStageId === stage.id && draggedLead.stageId !== stage.id}
              cardDragging={!!drag.dragId}
              columnOver={!!drag.dragColumnId && drag.overStageId === stage.id && drag.dragColumnId !== stage.id}
              columnDragged={drag.dragColumnId === stage.id}
              onMoveStage={(target, dir) => void moveStageBy(target, dir)}
              onLoadMore={board.loadMore}
              onRetry={board.reload}
              onHeaderDragStart={drag.startColumnDrag}
              onHeaderDragEnd={drag.endDrag}
              onDragEnter={drag.enterColumn}
              onDragLeave={drag.leaveColumn}
              onDrop={(target) => void drag.drop(target)}
            >
              {(column?.items ?? []).map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  stages={stages}
                  ownerName={lead.ownerId ? (ownerNames.get(lead.ownerId) ?? null) : null}
                  pending={board.isMoving(lead.id)}
                  dragging={drag.dragId === lead.id}
                  templates={templates ?? []}
                  onOpen={openLead}
                  onDragStart={drag.startCardDrag}
                  onDragEnd={drag.endDrag}
                  onMove={drag.moveLeadToStage}
                />
              ))}
            </KanbanColumn>
          );
        })}
      </div>

      {selectedLead && (
        <LeadDrawer
          key={selectedLead.id}
          lead={selectedLead}
          stages={stages}
          templates={templates ?? []}
          onClose={() => setSelectedLeadId(null)}
          onSaved={(lead) => board.applyLead(lead)}
          onDeleted={() => board.reload()}
        />
      )}

      {importing && firstOpenStage && (
        <LeadImportModal
          pipelineId={pipeline.id}
          stages={stages}
          defaultStageId={firstOpenStage.id}
          onClose={closeImport}
          onImported={() => board.reload()}
        />
      )}
    </div>
  );
}
