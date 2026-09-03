import { useState } from "react";
import { useProspectStages } from "../../hooks/useProspectStages";
import { useProspectStageActions } from "../../hooks/useProspectStageActions";
import { useProspects } from "../../hooks/useProspects";
import { useProspectActions } from "../../hooks/useProspectActions";
import { useMessageTemplates } from "../../hooks/useMessageTemplates";
import { useProspectLossReasons } from "../../hooks/useProspectLossReasons";
import { EmptyState } from "../common/EmptyState";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ProspectDrawer } from "./ProspectDrawer";
import { ProspectImportModal } from "./ProspectImportModal";
import { ManageStagesModal } from "./ManageStagesModal";
import { ManageLossReasonsModal } from "./ManageLossReasonsModal";
import { WhatsappButton } from "./WhatsappButton";
import { useToast } from "../../hooks/useToast";
import { prospectsService } from "../../services/ProspectsService";
import { ApiError } from "../../types/common";
import { PRIORITY, PROSPECT_ORIGIN, WHATSAPP_STATUS } from "../../constants/prospectEnums";
import type { Period } from "../../utils/periods";
import { computeStageTargetDate } from "../../utils/prospectCadence";
import { formatPhone } from "../../utils/phone";
import { BOARD_SORT_OPTIONS, sortBoardItems, type BoardSortOption } from "../../utils/boardSort";
import type {
  CreateProspectInput,
  MessageTemplate,
  Prospect,
  ProspectLossReason,
  ProspectOrigin,
  ProspectStage,
} from "../../types/prospect";
import styles from "./ProspectionBoard.module.css";

const ATIVO_BADGE = { label: "Ativo", color: "#a78bfa", bg: "rgba(167,139,250,.16)" };

function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-08-27" → "27/08" — cabe no canto do card mesmo minimizado; o ano
 * some de propósito (follow-up é sempre "próximos dias", não faz falta). */
function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/** Comparação lexicográfica pura já funciona pra "YYYY-MM-DD" — sem
 * `Date` de propósito, evita timezone mexer com "hoje" perto da meia-noite. */
function isOverdue(targetDateIso: string): boolean {
  return targetDateIso < new Date().toISOString().slice(0, 10);
}

function isToday(targetDateIso: string): boolean {
  return targetDateIso === new Date().toISOString().slice(0, 10);
}

/** Âncora efetiva da cadência pro prospect: `initialContactDate` quando
 * existe, senão a data de criação (P0 implícito pra quem foi cadastrado
 * antes dessa feature existir — ver `MoveProspectUseCase` no backend,
 * mesma regra espelhada aqui pra decidir se pergunta a data no move). */
function effectiveAnchor(prospect: Prospect): string {
  return prospect.initialContactDate ?? prospect.createdAt.slice(0, 10);
}

/**
 * Seção "Ativo (prospecção)" dentro do Pipeline unificado — visão só de
 * super admin. Kanban próprio (estágios/dados de `prospects`, isolados do
 * `leads`), mas vive na mesma tela que o funil normal (ver `PipelinePage`).
 */
export function ProspectionBoard({ period }: { period: Period }) {
  const {
    data: stages,
    loading: loadingStages,
    error: stagesError,
    notImplemented,
    reload: reloadStages,
  } = useProspectStages();
  const { move, backfillCadence } = useProspectActions();
  const { reorder: reorderStages } = useProspectStageActions();
  const { toast } = useToast();
  const { data: templates } = useMessageTemplates();
  const { data: lossReasons, reload: reloadLossReasons } = useProspectLossReasons();

  const { data, loading, error, reload } = useProspects({ ...period, page: 1, pageSize: 200 });
  const [dragId, setDragId] = useState<string | null>(null);
  // Arrastar uma COLUNA (reordenar estágios) é uma operação diferente de
  // arrastar um CARD (mover prospect de estágio) — estado separado pra não
  // confundir os dois num mesmo drop (ver `handleDrop`).
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [managingStages, setManagingStages] = useState(false);
  const [managingLossReasons, setManagingLossReasons] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [sortOption, setSortOption] = useState<BoardSortOption>("none");
  // Move pendente aguardando a data alvo (só quando o estágio de destino
  // pede — ver `stage.asksTargetDate`); some assim que confirma ou pula.
  const [pendingMove, setPendingMove] = useState<{
    prospectId: string;
    stageId: string;
    stageName: string;
  } | null>(null);
  // Move pendente aguardando o motivo da perda (estágio de destino
  // `isLost`) — some assim que confirma ou pula (`LossReasonPrompt`).
  const [pendingLossMove, setPendingLossMove] = useState<{
    prospectId: string;
    stageId: string;
    stageName: string;
  } | null>(null);

  async function handleDrop(targetStageId: string) {
    if (dragColumnId) {
      const draggedStageId = dragColumnId;
      setDragColumnId(null);
      if (draggedStageId === targetStageId || !stages) return;
      const ids = stages.map((s) => s.id);
      const fromIndex = ids.indexOf(draggedStageId);
      const toIndex = ids.indexOf(targetStageId);
      if (fromIndex === -1 || toIndex === -1) return;
      ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, draggedStageId);
      try {
        await reorderStages(ids);
        reloadStages();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não foi possível reordenar os estágios");
      }
      return;
    }
    if (!dragId) return;
    const prospectId = dragId;
    setDragId(null);
    const current = prospects.find((p) => p.id === prospectId);
    if (!current || current.stageId === targetStageId) return; // solto na própria coluna — nada a fazer
    const targetStage = stages?.find((s) => s.id === targetStageId);
    // Estágio "perdido" pede o motivo ANTES de qualquer outra coisa — não
    // faz sentido também perguntar data de follow-up pra um prospect que
    // acabou de ser marcado como perdido.
    if (targetStage?.isLost) {
      setPendingLossMove({ prospectId, stageId: targetStageId, stageName: targetStage.name });
      return;
    }
    // Se a cadência automática já cobre o caminho até `targetStageId` (todo
    // estágio no meio tem `followupBusinessDays` configurado — ver
    // `computeStageTargetDate`), o backend vai calcular a data sozinho e
    // ignorar qualquer coisa que a gente mande aqui (`MoveProspectUseCase`
    // dá prioridade à cadência) — não faz sentido perguntar nesse caso.
    const autoComputed = computeStageTargetDate(
      stages ?? [],
      targetStageId,
      effectiveAnchor(current),
    );
    if (targetStage?.asksTargetDate && autoComputed === null) {
      setPendingMove({ prospectId, stageId: targetStageId, stageName: targetStage.name });
      return;
    }
    await move(prospectId, targetStageId);
    reload();
  }

  async function handleConfirmPendingMove(targetDate: string | null) {
    if (!pendingMove) return;
    const { prospectId, stageId } = pendingMove;
    setPendingMove(null);
    try {
      await move(prospectId, stageId, targetDate);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível mover o prospect");
    }
  }

  async function handleConfirmPendingLossMove(lossReasonId: string | null) {
    if (!pendingLossMove) return;
    const { prospectId, stageId } = pendingLossMove;
    setPendingLossMove(null);
    try {
      await move(prospectId, stageId, undefined, lossReasonId);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível mover o prospect");
    }
  }

  async function handleBackfillCadence() {
    setBackfilling(true);
    try {
      const updated = await backfillCadence();
      toast(
        updated > 0
          ? `${updated} prospect(s) com data recalculada`
          : "Nenhum prospect precisava de recálculo",
      );
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível recalcular as datas");
    } finally {
      setBackfilling(false);
    }
  }

  function handleExport() {
    void (async () => {
      try {
        const csv = await prospectsService.exportCsv();
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "prospeccao-gsm.csv";
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não foi possível exportar.");
      }
    })();
  }

  if (notImplemented) {
    return (
      <div>
        <div className={styles.header}>
          <div>
            <h2 className={styles.sectionTitle}>
              <Badge {...ATIVO_BADGE} />
              Prospecção GSM
            </h2>
          </div>
        </div>
        <EmptyState
          title="Não disponível no modo Demonstração"
          message="Prospecção GSM é uma área interna da GSM Automação, sem dados fictícios para mostrar aqui. Acesse com a conta real de super admin para usar."
        />
      </div>
    );
  }

  if (stagesError) {
    return <EmptyState title="Não foi possível carregar os estágios" message={stagesError.message} />;
  }
  if (loadingStages) return <div className={styles.loading}>Carregando…</div>;

  const prospects = data?.items ?? [];
  const selected = prospects.find((p) => p.id === selectedId) ?? null;
  const firstStageId = stages?.[0]?.id;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h2 className={styles.sectionTitle}>
            <Badge {...ATIVO_BADGE} />
            Prospecção GSM
          </h2>
          <p className={styles.sectionSubtitle}>
            {data ? `${data.total} prospects` : "Carregando…"} — carteira comercial interna
          </p>
        </div>
        <div className={styles.toolbar}>
          <select
            className={styles.sortSelect}
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as BoardSortOption)}
          >
            {BOARD_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button onClick={() => setManagingStages(true)}>Estágios</Button>
          <Button onClick={() => setManagingLossReasons(true)}>Motivos de perda</Button>
          <Button
            onClick={() => void handleBackfillCadence()}
            disabled={backfilling}
            title="Preenche a data de follow-up de prospects que ainda não têm (cadastrados antes da cadência automática existir)"
          >
            {backfilling ? "Recalculando…" : "Recalcular datas"}
          </Button>
          <Button onClick={() => setImporting(true)}>Importar CSV</Button>
          <Button onClick={handleExport}>Exportar CSV</Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Novo prospect
          </Button>
        </div>
      </div>

      {error && <EmptyState title="Não foi possível carregar os prospects" message={error.message} />}

      {!error && stages && stages.length === 0 && (
        <EmptyState
          title="Nenhum estágio cadastrado ainda"
          message='Clique em "Estágios" para criar a primeira coluna da pipeline.'
        />
      )}

      {!error && stages && stages.length > 0 && (
        <div className={styles.board}>
          {stages.map((stage) => {
            const stageProspects = sortBoardItems(
              prospects.filter((p) => p.stageId === stage.id),
              sortOption,
              (p) => p.companyName,
              (p) => p.createdAt,
            );
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
                  <span className={styles.columnLabel}>{stage.name}</span>
                  <span className={styles.columnCount}>{stageProspects.length}</span>
                </div>
                <div className={styles.cards}>
                  {stageProspects.map((prospect) => (
                    <ProspectCard
                      key={prospect.id}
                      prospect={prospect}
                      stage={stage}
                      templates={templates ?? []}
                      onDragStart={() => setDragId(prospect.id)}
                      onClick={() => setSelectedId(prospect.id)}
                    />
                  ))}
                  {stageProspects.length === 0 && !loading && (
                    <div className={styles.empty}>Sem prospects</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <ProspectDrawer
          prospect={selected}
          stages={stages ?? []}
          templates={templates ?? []}
          lossReasons={lossReasons ?? []}
          onClose={() => setSelectedId(null)}
          onSaved={() => reload()}
          onDeleted={() => {
            setSelectedId(null);
            reload();
          }}
        />
      )}

      {creating && stages && firstStageId && (
        <QuickCreateModal
          defaultStageId={firstStageId}
          stages={stages}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}

      {importing && stages && firstStageId && (
        <ProspectImportModal
          stages={stages}
          defaultStageId={firstStageId}
          onClose={() => setImporting(false)}
          onImported={() => reload()}
        />
      )}

      {managingStages && (
        <ManageStagesModal
          stages={stages ?? []}
          onClose={() => setManagingStages(false)}
          onChanged={() => {
            reloadStages();
            reload();
          }}
        />
      )}

      {managingLossReasons && (
        <ManageLossReasonsModal
          reasons={lossReasons ?? []}
          onClose={() => setManagingLossReasons(false)}
          onChanged={() => reloadLossReasons()}
        />
      )}

      {pendingMove && (
        <TargetDatePrompt
          stageName={pendingMove.stageName}
          onConfirm={(date) => void handleConfirmPendingMove(date)}
          onSkip={() => void handleConfirmPendingMove(null)}
        />
      )}

      {pendingLossMove && (
        <LossReasonPrompt
          stageName={pendingLossMove.stageName}
          reasons={lossReasons ?? []}
          onConfirm={(reasonId) => void handleConfirmPendingLossMove(reasonId)}
          onSkip={() => void handleConfirmPendingLossMove(null)}
        />
      )}
    </div>
  );
}

/** Só aparece quando o estágio de destino do move tem `asksTargetDate`
 * ligado (ver `SettingsPage.tsx` → Prospecção — Estágios). Atalhos de dias
 * cobrem o caso comum (retomar em N dias); o campo de data é pra quando o
 * follow-up é numa data específica em vez de "daqui a X dias". */
function TargetDatePrompt({
  stageName,
  onConfirm,
  onSkip,
}: {
  stageName: string;
  onConfirm: (date: string) => void;
  onSkip: () => void;
}) {
  const [date, setDate] = useState("");

  function pickShortcut(days: number) {
    onConfirm(isoInDays(days));
  }

  return (
    <div className={styles.overlay} onClick={onSkip}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Quando retomar contato?</h2>
        <p className={styles.modalSubtitle}>
          Movendo pra <strong>{stageName}</strong> — defina uma data alvo de follow-up (opcional).
        </p>
        <div className={styles.dateShortcuts}>
          <button type="button" className={styles.dateShortcutBtn} onClick={() => pickShortcut(1)}>
            +1 dia
          </button>
          <button type="button" className={styles.dateShortcutBtn} onClick={() => pickShortcut(2)}>
            +2 dias
          </button>
          <button type="button" className={styles.dateShortcutBtn} onClick={() => pickShortcut(3)}>
            +3 dias
          </button>
          <button type="button" className={styles.dateShortcutBtn} onClick={() => pickShortcut(7)}>
            +7 dias
          </button>
        </div>
        <input
          className={styles.input}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className={styles.modalActions}>
          <Button onClick={onSkip}>Pular</Button>
          <Button variant="primary" onClick={() => date && onConfirm(date)} disabled={!date}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Aparece ao mover um card pra um estágio `isLost` — motivo é opcional
 * (dá pra pular quando ainda não configurou nenhum em "Motivos de perda"),
 * mas registrar ajuda a montar o relatório de perdas depois. */
function LossReasonPrompt({
  stageName,
  reasons,
  onConfirm,
  onSkip,
}: {
  stageName: string;
  reasons: ProspectLossReason[];
  onConfirm: (reasonId: string) => void;
  onSkip: () => void;
}) {
  const [reasonId, setReasonId] = useState("");

  return (
    <div className={styles.overlay} onClick={onSkip}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Qual o motivo da perda?</h2>
        <p className={styles.modalSubtitle}>
          Movendo pra <strong>{stageName}</strong> — registrar o motivo alimenta o relatório de
          perdas depois (opcional).
        </p>
        {reasons.length === 0 ? (
          <p className={styles.modalSubtitle}>
            Nenhum motivo cadastrado ainda — configure em "Motivos de perda".
          </p>
        ) : (
          <select
            className={styles.select}
            value={reasonId}
            onChange={(e) => setReasonId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
        <div className={styles.modalActions}>
          <Button onClick={onSkip}>Pular</Button>
          <Button variant="primary" onClick={() => reasonId && onConfirm(reasonId)} disabled={!reasonId}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProspectCard({
  prospect,
  stage,
  templates,
  onDragStart,
  onClick,
}: {
  prospect: Prospect;
  stage: ProspectStage;
  templates: MessageTemplate[];
  onDragStart: () => void;
  onClick: () => void;
}) {
  const priority = PRIORITY[prospect.priority];
  const whatsapp = WHATSAPP_STATUS[prospect.whatsappStatus];
  return (
    <div className={styles.card} draggable onDragStart={onDragStart} onClick={onClick}>
      <div className={styles.cardTop}>
        <div className={styles.cardName}>{prospect.companyName}</div>
        {/* Canto superior direito do card — prioridade sempre, data alvo
            embaixo dela só quando marcada (mesmo com o card minimizado,
            sem precisar abrir o drawer pra saber quando retomar contato). */}
        <div className={styles.cardTopRight}>
          <Badge label={priority.label} color={priority.color} bg={priority.bg} />
          {prospect.targetDate && (
            <span
              className={`${styles.targetDate} ${
                isOverdue(prospect.targetDate)
                  ? styles.targetDateOverdue
                  : isToday(prospect.targetDate)
                    ? styles.targetDateToday
                    : ""
              }`}
              title={
                isOverdue(prospect.targetDate)
                  ? `Follow-up atrasado — era pra ${formatShortDate(prospect.targetDate)}`
                  : isToday(prospect.targetDate)
                    ? "Follow-up é hoje"
                    : `Follow-up marcado pra ${formatShortDate(prospect.targetDate)}`
              }
            >
              📅 {formatShortDate(prospect.targetDate)}
            </span>
          )}
        </div>
      </div>
      <div className={styles.cardMeta}>
        {[prospect.city, prospect.niche].filter(Boolean).join(" · ") || "—"}
      </div>
      <div className={styles.cardFooter}>
        <span className={styles.cardMeta}>{prospect.phoneRaw || "sem telefone"}</span>
        <Badge label={whatsapp.label} color={whatsapp.color} bg={whatsapp.bg} />
      </div>
      <WhatsappButton prospect={prospect} stage={stage} templates={templates} size="small" />
      {prospect.lastComment && (
        <div className={styles.cardComment} title={prospect.lastComment.text}>
          💬 {prospect.lastComment.text}
        </div>
      )}
    </div>
  );
}

function QuickCreateModal({
  defaultStageId,
  stages,
  onClose,
  onCreated,
}: {
  defaultStageId: string;
  stages: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { create } = useProspectActions();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [stageId, setStageId] = useState(defaultStageId);
  const [origin, setOrigin] = useState<ProspectOrigin>("google_maps");
  const [submitting, setSubmitting] = useState(false);
  const [duplicateNote, setDuplicateNote] = useState(false);

  async function handleSubmit(force = false) {
    if (!companyName.trim()) return;
    setSubmitting(true);
    setDuplicateNote(false);
    try {
      const input: CreateProspectInput = {
        stageId,
        companyName: companyName.trim(),
        origin,
        force,
        ...(phoneRaw.trim() ? { phoneRaw: phoneRaw.trim() } : {}),
      };
      await create(input);
      toast("Prospect criado com sucesso");
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDuplicateNote(true);
      } else {
        toast(err instanceof Error ? err.message : "Não foi possível criar o prospect");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Novo prospect</h2>
        <input
          className={styles.input}
          placeholder="Nome da empresa"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Telefone"
          value={phoneRaw}
          onChange={(e) => setPhoneRaw(formatPhone(e.target.value))}
        />
        <select className={styles.select} value={stageId} onChange={(e) => setStageId(e.target.value)}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={origin}
          onChange={(e) => setOrigin(e.target.value as ProspectOrigin)}
        >
          {Object.entries(PROSPECT_ORIGIN).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        {duplicateNote && (
          <p className={styles.duplicateNote}>
            Já existe um prospect com esse telefone, nome de empresa ou link do Google Maps.
          </p>
        )}
        <div className={styles.modalActions}>
          <Button onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          {duplicateNote ? (
            <Button variant="primary" onClick={() => void handleSubmit(true)} disabled={submitting}>
              Cadastrar mesmo assim
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => void handleSubmit(false)}
              disabled={submitting || !companyName.trim()}
            >
              {submitting ? "Salvando…" : "Criar prospect"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
