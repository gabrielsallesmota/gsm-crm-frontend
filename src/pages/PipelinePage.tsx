import { lazy, Suspense, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePipelines } from "../hooks/usePipelines";
import { usePipelineActions } from "../hooks/usePipelineActions";
import { usePipelineBoard, type BoardFilter } from "../hooks/usePipelineBoard";
import { useLeadActions } from "../hooks/useLeadActions";
import { useLeadMessageTemplates } from "../hooks/useLeadMessageTemplates";
import { useTeamDirectory } from "../hooks/useTeamDirectory";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";
import { can } from "../auth/permissions";
import { EmptyState } from "../components/common/EmptyState";
import { HelpTip } from "../components/common/HelpTip";
import { SkeletonRows } from "../components/common/Skeleton";
import { usePageTitle } from "../hooks/usePageTitle";
import { useMarkOnboardingVisit } from "../hooks/useOnboarding";
import { ROUTES } from "../constants/routes";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { PeriodFilter } from "../components/common/PeriodFilter";
import { LeadDrawer } from "../components/leads/LeadDrawer";
import { LeadImportModal } from "../components/leads/LeadImportModal";
import { WhatsappButton } from "../components/leads/WhatsappButton";
// Prospecção é funil INTERNO da GSM (só platform staff) — chunk próprio,
// nunca baixado por usuário de tenant. Não é controle de acesso: o backend
// recusa /prospects para quem não é staff.
const ProspectionBoard = lazy(() =>
  import("../components/prospects/ProspectionBoard").then((m) => ({ default: m.ProspectionBoard })),
);
import { originOf } from "../constants/origins";
import { BOARD_SORT_OPTIONS, sortBoardItems, type BoardSortOption } from "../utils/boardSort";
import { brl } from "../utils/currency";
import { findLead, hasMore, reorderIds } from "../utils/pipelineBoard";
import { EMPTY_PERIOD, type Period } from "../utils/periods";
import type { PipelineStage } from "../types/pipeline";
import type { Lead, LeadMessageTemplate } from "../types/lead";
import styles from "./PipelinePage.module.css";

type SourceFilter = "todos" | "ativo" | "passivo";

const PASSIVO_BADGE = { label: "Passivo", color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" };

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

      <PeriodFilter value={period} onChange={setPeriod} />

      {showPassivo && <LeadsPipelineBoard taggedPassivo={isSuperAdmin} period={period} />}

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
 * (select no card e na ficha do lead).
 */
function LeadsPipelineBoard({ taggedPassivo, period }: { taggedPassivo: boolean; period: Period }) {
  const {
    data: pipelines,
    loading: loadingPipelines,
    error: pipelineError,
    reload: reloadPipelines,
  } = usePipelines();
  const { reorderStages } = usePipelineActions();
  const { exportCsv } = useLeadActions();
  const { data: templates } = useLeadMessageTemplates();
  const { data: team } = useTeamDirectory();
  const { toast, toastError } = useToast();
  const { user } = useAuth();
  // Reordenar estágios é configuração (ADMIN/GESTOR no backend) — vendedor
  // não vê a alça de arrastar coluna. Ver auth/permissions.ts.
  const canReorderStages = can(user, "pipeline.reorder");
  const canFilterByOwner = can(user, "leads.viewAll");
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
  const filter: BoardFilter = {
    ...period,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(ownerFilter === "__none__" ? { unassigned: true } : ownerFilter ? { ownerId: ownerFilter } : {}),
  };
  const board = usePipelineBoard(pipeline?.id ?? null, stages, filter);

  const [dragId, setDragId] = useState<string | null>(null);
  // Arrastar uma COLUNA (reordenar etapas) é diferente de arrastar um CARD
  // (mover lead de etapa) — estado separado, mesmo padrão de
  // `ProspectionBoard.tsx`.
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
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
  const [sortOption, setSortOption] = useState<BoardSortOption>("none");

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

  async function handleDrop(target: PipelineStage) {
    if (dragColumnId) {
      const draggedStageId = dragColumnId;
      setDragColumnId(null);
      if (!pipeline) return;
      const ids = reorderIds(
        stages.map((s) => s.id),
        draggedStageId,
        target.id,
      );
      if (!ids) return;
      try {
        await reorderStages(pipeline.id, ids);
        toast("Ordem das etapas atualizada");
        reloadPipelines();
      } catch (err) {
        toastError(err, "Não foi possível reordenar as etapas");
      }
      return;
    }
    if (!dragId) return;
    const leadId = dragId;
    setDragId(null);
    await moveLead(leadId, target);
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
        toastError(err, "Não foi possível exportar.");
      }
    })();
  }

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

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            {taggedPassivo && <Badge {...PASSIVO_BADGE} />} Pipeline
          </h1>
          <p className={styles.pageSubtitle}>
            Arraste os cards entre as etapas — ou abra o lead e escolha a etapa
            <HelpTip label="Como funciona o pipeline">
              <span>
                Cada coluna é uma etapa da venda. Quando a negociação avança, mova o lead para a
                próxima etapa: arrastando o card, pelo seletor de etapa do card (no celular) ou
                abrindo o lead.
              </span>
              <span>
                Etapas com 🏆 contam como <b>ganho</b> e com ✕ como <b>perda</b> — é isso que
                alimenta a conversão e a receita do Dashboard.
              </span>
            </HelpTip>
          </p>
        </div>
        <div className={styles.toolbar}>
          {pipelines && pipelines.length > 1 && (
            <select
              className={styles.pipelineSelect}
              value={pipeline.id}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              aria-label="Pipeline"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <input
            className={styles.pipelineSelect}
            placeholder="Buscar lead…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar lead"
          />
          {canFilterByOwner && (
            <select
              className={styles.pipelineSelect}
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              aria-label="Responsável"
            >
              <option value="">Todos os responsáveis</option>
              <option value="__none__">Sem responsável</option>
              {team?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <select
            className={styles.pipelineSelect}
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as BoardSortOption)}
            aria-label="Ordenação"
          >
            {BOARD_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button onClick={() => setImporting(true)}>Importar planilha</Button>
          <Button onClick={handleExport}>Exportar CSV</Button>
        </div>
      </div>

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

      <div className={styles.board}>
        {stages.map((stage) => {
          const column = board.board[stage.id];
          const stageLeads = sortBoardItems(
            column?.items ?? [],
            sortOption,
            (l) => l.name,
            (l) => l.createdAt,
          );
          return (
            <div
              key={stage.id}
              className={styles.column}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void handleDrop(stage)}
            >
              <div
                className={styles.columnHeader}
                draggable={canReorderStages}
                onDragStart={() => canReorderStages && setDragColumnId(stage.id)}
                title={canReorderStages ? "Arraste pra reordenar as etapas" : undefined}
              >
                <span className={styles.columnDot} style={{ background: stage.color }} />
                <span className={styles.columnLabel}>
                  {stage.label}
                  {stage.isWon ? " 🏆" : stage.isLost ? " ✕" : ""}
                </span>
                <span className={styles.columnCount} title="Total real nesta etapa">
                  {column && column.page > 0 ? column.total : "…"}
                </span>
              </div>
              <div className={styles.cards}>
                {stageLeads.map((lead) => (
                  <KanbanCard
                    key={lead.id}
                    lead={lead}
                    stages={stages}
                    ownerName={lead.ownerId ? (ownerNames.get(lead.ownerId) ?? null) : null}
                    pending={board.isMoving(lead.id)}
                    templates={templates ?? []}
                    onDragStart={() => setDragId(lead.id)}
                    onClick={() => setSelectedLeadId(lead.id)}
                    onMove={(target) => void moveLead(lead.id, target)}
                  />
                ))}
                {column?.error && (
                  <div className={styles.columnError} role="alert">
                    {column.error}{" "}
                    <button type="button" className={styles.linkBtn} onClick={board.reload}>
                      Tentar de novo
                    </button>
                  </div>
                )}
                {column?.loading && <div className={styles.empty}>Carregando…</div>}
                {column && !column.loading && !column.error && stageLeads.length === 0 && (
                  <div className={styles.empty}>Sem leads</div>
                )}
                {column && !column.loading && hasMore(column) && (
                  <button type="button" className={styles.loadMore} onClick={() => board.loadMore(stage.id)}>
                    Carregar mais ({column.total - column.items.length})
                  </button>
                )}
              </div>
            </div>
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

function KanbanCard({
  lead,
  stages,
  ownerName,
  pending,
  templates,
  onDragStart,
  onClick,
  onMove,
}: {
  lead: Lead;
  stages: PipelineStage[];
  ownerName: string | null;
  pending: boolean;
  templates: LeadMessageTemplate[];
  onDragStart: () => void;
  onClick: () => void;
  onMove: (stage: PipelineStage) => void;
}) {
  const origin = originOf(lead.origin);
  return (
    <div
      className={pending ? `${styles.card} ${styles.cardPending}` : styles.card}
      draggable={!pending}
      onDragStart={onDragStart}
      onClick={onClick}
      // Teclado: Tab chega no card, Enter/Espaço abre o lead (lá dá para
      // trocar a etapa sem arrastar).
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${lead.name}`}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-busy={pending}
    >
      <div className={styles.cardName}>{lead.name}</div>
      {lead.company && <div className={styles.cardCompany}>{lead.company}</div>}
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
      <div className={styles.cardOwner}>{ownerName ?? (lead.ownerId ? "—" : "Sem responsável")}</div>
      {/* Alternativa ao arrastar (celular/teclado): mover pela lista. */}
      <select
        className={styles.cardMove}
        value={lead.stageId}
        disabled={pending}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const target = stages.find((s) => s.id === e.target.value);
          if (target) onMove(target);
        }}
        aria-label={`Mover ${lead.name} para outra etapa`}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <WhatsappButton lead={lead} templates={templates} size="small" />
    </div>
  );
}
