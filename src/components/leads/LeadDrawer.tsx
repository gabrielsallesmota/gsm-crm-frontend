import { useEffect, useRef, useState } from "react";
import type { Lead, LeadMessageTemplate, UpdateLeadInput } from "../../types/lead";
import type { PipelineStage } from "../../types/pipeline";
import type { Task } from "../../types/task";
import { ApiError } from "../../types/common";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { ConfirmLostDialog } from "./ConfirmLostDialog";
import { ClaimLeadDialog } from "./ClaimLeadDialog";
import { useLeadServices } from "../../hooks/useLeadServices";
import { initialStageOf, needsClaimPrompt } from "../../utils/leadClaim";
import { needsLostConfirmation } from "../../utils/pipelineBoard";
import { TaskFormModal } from "../tasks/TaskFormModal";
import { CreateClientFromLeadDialog } from "../clients/CreateClientFromLeadDialog";
import {
  formFromLead,
  isFormDirty,
  validateLeadForm,
  type LeadFormField,
  type LeadFormValues,
} from "../../utils/leadForm";
import { useLeadActions } from "../../hooks/useLeadActions";
import { useLeadTimeline } from "../../hooks/useLeadTimeline";
import { useLeadCommentActions } from "../../hooks/useLeadCommentActions";
import { usePipelines } from "../../hooks/usePipelines";
import { useTags } from "../../hooks/useTags";
import { useTasks } from "../../hooks/useTasks";
import { useTaskActions } from "../../hooks/useTaskActions";
import { useTeamDirectory } from "../../hooks/useTeamDirectory";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../hooks/useDialog";
import { can } from "../../auth/permissions";
import { hasFeature } from "../../auth/features";
import { ActivitySection, TIMELINE_MAX_LIMIT } from "./drawer/ActivitySection";
import { DrawerHeader } from "./drawer/DrawerHeader";
import { LeadContact } from "./drawer/LeadContact";
import { LeadEditForm } from "./drawer/LeadEditForm";
import { LeadSummary } from "./drawer/LeadSummary";
import { MoreDetails } from "./drawer/MoreDetails";
import { TasksSection } from "./drawer/TasksSection";
import styles from "./LeadDrawer.module.css";

/** Probabilidade fora de 0–100 é ajustada em silêncio ao salvar (comportamento histórico). */
const NON_BLOCKING: readonly LeadFormField[] = ["probability"];

type Discard = "close" | "cancel";

/**
 * Painel do lead — fluxo comercial completo sem sair daqui. Orquestra estado e chamadas; a
 * apresentação vive em `./drawer/*`. Etapa e responsável gravam na hora (select, alternativa ao
 * arrastar, essencial no celular; só admin/gestor reatribuem); os demais dados passam pelo
 * formulário, com proteção contra perda de alterações. Tarefas e timeline são REAIS
 * (`GET /leads/{id}/timeline`). Nada de seção fictícia (IA, temperatura...).
 */
export function LeadDrawer({
  lead,
  stages,
  templates = [],
  onClose,
  onSaved,
  onDeleted,
}: {
  lead: Lead;
  /** Etapas do pipeline do lead; omitido = busca pelos pipelines. */
  stages?: PipelineStage[];
  templates?: LeadMessageTemplate[];
  onClose: () => void;
  onSaved?: (lead: Lead) => void;
  onDeleted?: (leadId: string) => void;
}) {
  const { user } = useAuth();
  const canAssign = can(user, "leads.assign");
  const { toast, toastError } = useToast();
  const { update, move, claim, delete: deleteLead } = useLeadActions();
  const { data: niches } = useLeadServices();
  const { create: createComment } = useLeadCommentActions();
  const { setDone } = useTaskActions();
  const { data: availableTags } = useTags();
  const { data: team } = useTeamDirectory();
  const { data: pipelines } = usePipelines();
  const [timelineLimit, setTimelineLimit] = useState<number | undefined>(undefined);
  const timeline = useLeadTimeline(lead.id, timelineLimit);
  const tasks = useTasks({ scope: "all", leadId: lead.id, page: 1, pageSize: 50 });

  const pipelineStages =
    stages ?? pipelines?.find((p) => p.id === lead.pipelineId)?.stages ?? [];
  const stage = pipelineStages.find((s) => s.id === lead.stageId);
  const ownerName = lead.ownerId
    ? (team?.find((m) => m.id === lead.ownerId)?.name ?? "—")
    : "Sem responsável";
  const nicheName = lead.serviceId ? (niches?.find((n) => n.id === lead.serviceId)?.name ?? null) : null;
  // Vendedor num lead da fila (sem dono) ainda não cria tarefa: o backend só libera tarefas ao dono.
  const canCreateTask = Boolean(lead.ownerId) || can(user, "leads.viewAll");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [form, setForm] = useState<LeadFormValues>(() => formFromLead(lead));
  const [touched, setTouched] = useState<ReadonlySet<LeadFormField>>(new Set());
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<Discard | null>(null);
  const [confirmLostStage, setConfirmLostStage] = useState<string | null>(null);
  const [claimStage, setClaimStage] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  // "Criar cliente?" — ao ganhar o lead (pergunta, não impõe) ou pelo botão do cabeçalho.
  const [clientDialog, setClientDialog] = useState(false);
  const offersClient = hasFeature(user, "clients");
  const [gone, setGone] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const errors = validateLeadForm(form);
  const formDirty = editing && isFormDirty(form, lead);
  // Esc/clique fora não descartam edição nem comentário em andamento.
  const hasUnsaved = () => editing || newComment.trim().length > 0;
  useDialog(drawerRef, onClose, hasUnsaved);

  useEffect(() => {
    if (editing) drawerRef.current?.querySelector<HTMLElement>('input[aria-required="true"]')?.focus();
  }, [editing]);

  function afterChange(updated: Lead) {
    onSaved?.(updated);
    timeline.reload();
  }

  /** 404 numa ação = o lead sumiu (excluído por outra pessoa): avisa e oferece atualizar o quadro. */
  function fail(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.status === 404) setGone(true);
    toastError(err, fallback);
  }

  async function handleMove(stageId: string): Promise<boolean> {
    if (stageId === lead.stageId) return true;
    setMoving(true);
    try {
      const updated = await move(lead.id, stageId);
      const target = pipelineStages.find((s) => s.id === stageId);
      toast(
        target?.isWon
          ? "Negócio marcado como ganho"
          : target?.isLost
            ? "Negócio marcado como perdido"
            : `Movido para ${target?.label ?? "a nova etapa"}`,
      );
      afterChange(updated);
      if (target?.isWon && offersClient) setClientDialog(true);
      return true;
    } catch (err) {
      fail(err, "Não foi possível mover o lead.");
      return false;
    } finally {
      setMoving(false);
    }
  }

  /** D-03: marcar como perdido pede confirmação (sem motivo obrigatório). Lead sem dono saindo
   * da etapa inicial pergunta antes "Vincular a você?". */
  function requestMove(stageId: string, askClaim = true) {
    if (stageId === lead.stageId) return;
    const target = pipelineStages.find((s) => s.id === stageId);
    if (askClaim && target && needsClaimPrompt(lead, target, initialStageOf(pipelineStages))) {
      setClaimStage(stageId);
    } else if (target && needsLostConfirmation(stage, target)) setConfirmLostStage(stageId);
    else void handleMove(stageId);
  }

  /** Assume o lead; `false` = não conseguiu (409: outra pessoa assumiu antes). */
  async function handleClaim(): Promise<boolean> {
    setClaiming(true);
    try {
      const updated = await claim(lead.id);
      toast("Lead vinculado a você");
      afterChange(updated);
      return true;
    } catch (err) {
      fail(err, "Não foi possível vincular o lead.");
      return false;
    } finally {
      setClaiming(false);
    }
  }

  async function handleAssign(ownerId: string) {
    if (!ownerId || ownerId === lead.ownerId) return;
    setAssigning(true);
    try {
      const updated = await update(lead.id, { ownerId });
      toast("Responsável atualizado");
      afterChange(updated);
    } catch (err) {
      fail(err, "Não foi possível trocar o responsável.");
    } finally {
      setAssigning(false);
    }
  }

  async function handlePostComment() {
    const text = newComment.trim();
    if (!text) return;
    setPostingComment(true);
    try {
      await createComment(lead.id, text);
      setNewComment("");
      timeline.reload();
    } catch (err) {
      fail(err, "Não foi possível adicionar o comentário");
    } finally {
      setPostingComment(false);
    }
  }

  async function handleToggleTask(task: Task) {
    try {
      await setDone(task.id, !task.done);
      tasks.reload();
      timeline.reload();
    } catch (err) {
      fail(err, "Não foi possível atualizar a tarefa.");
    }
  }

  function startEditing() {
    setForm(formFromLead(lead));
    setTouched(new Set());
    setEditing(true);
  }

  function stopEditing() {
    setEditing(false);
    setTouched(new Set());
  }

  function patchForm(patch: Partial<LeadFormValues>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function touch(field: LeadFormField) {
    setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));
  }

  async function handleSave() {
    const blocking = Object.keys(errors).filter((f) => !NON_BLOCKING.includes(f as LeadFormField));
    if (blocking.length > 0) {
      setTouched(new Set(Object.keys(errors) as LeadFormField[]));
      requestAnimationFrame(() =>
        drawerRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setSaving(true);
    try {
      const input: UpdateLeadInput = {
        name: form.name.trim(),
        company: form.company.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        value: form.value,
        probability: Math.min(100, Math.max(0, Number(form.probability) || 0)),
        origin: form.origin,
        notes: form.notes,
        tags: form.tags,
      };
      const updated = await update(lead.id, input);
      toast("Lead atualizado com sucesso");
      afterChange(updated);
      stopEditing();
    } catch (err) {
      fail(err, "Não foi possível salvar as alterações");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<boolean> {
    try {
      await deleteLead(lead.id);
      toast("Lead excluído");
      onDeleted?.(lead.id);
      onClose();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível excluir o lead.");
      return false;
    }
  }

  /** Botão Fechar: com alterações não salvas, confirma antes de descartar. */
  function requestClose() {
    if (formDirty || newComment.trim()) setConfirmDiscard("close");
    else onClose();
  }

  function requestCancelEdit() {
    if (formDirty) setConfirmDiscard("cancel");
    else stopEditing();
  }

  async function confirmDiscardNow(): Promise<boolean> {
    if (confirmDiscard === "close") onClose();
    else stopEditing();
    return true;
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !hasUnsaved()) onClose();
      }}
    >
      <div
        ref={drawerRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`Lead ${lead.name}`}
        tabIndex={-1}
      >
        <DrawerHeader
          lead={lead}
          stage={stage}
          ownerName={ownerName}
          templates={templates}
          editing={editing}
          onEdit={startEditing}
          onClose={requestClose}
          {...(stage?.isWon && offersClient ? { onCreateClient: () => setClientDialog(true) } : {})}
        />

        <div className={styles.body}>
          {gone && (
            <div className={styles.banner} role="alert">
              <span>Este lead não foi encontrado — ele pode ter sido excluído por outra pessoa.</span>
              <Button
                onClick={() => {
                  onDeleted?.(lead.id);
                  onClose();
                }}
              >
                Fechar e atualizar o quadro
              </Button>
            </div>
          )}

          {(nicheName || !lead.ownerId) && (
            <div className={`${styles.banner} ${styles.bannerInfo}`} role="note">
              <span>
                {nicheName ? `Nicho: ${nicheName}` : "Sem nicho"}
                {!lead.ownerId ? " · na fila, sem responsável" : ""}
              </span>
              {!lead.ownerId && (
                <Button variant="primary" onClick={() => void handleClaim()} disabled={claiming}>
                  {claiming ? "Vinculando…" : "Vincular a mim"}
                </Button>
              )}
            </div>
          )}

          <LeadSummary
            lead={lead}
            stages={pipelineStages}
            team={team}
            canAssign={canAssign}
            ownerName={ownerName}
            editing={editing}
            moving={moving}
            assigning={assigning}
            onMove={requestMove}
            onAssign={(id) => void handleAssign(id)}
          />

          {editing ? (
            <section className={styles.section}>
              <LeadEditForm
                values={form}
                errors={errors}
                touched={touched}
                availableTags={availableTags}
                onChange={patchForm}
                onTouch={touch}
              />
            </section>
          ) : (
            <>
              <LeadContact lead={lead} />
              <MoreDetails lead={lead} availableTags={availableTags} />
            </>
          )}

          <TasksSection
            tasks={tasks}
            onToggle={(t) => void handleToggleTask(t)}
            {...(canCreateTask ? { onCreate: () => setCreatingTask(true) } : {})}
          />

          <ActivitySection
            timeline={timeline}
            limit={timelineLimit}
            onRaiseLimit={() => setTimelineLimit(TIMELINE_MAX_LIMIT)}
            comment={newComment}
            posting={postingComment}
            onCommentChange={setNewComment}
            onPost={() => void handlePostComment()}
          />

          <div className={styles.dangerZone}>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Excluir lead
            </Button>
          </div>
        </div>

        {editing && (
          <div className={styles.footer}>
            {formDirty && (
              <span className={styles.footerNote} role="status">
                Alterações não salvas
              </span>
            )}
            <Button onClick={requestCancelEdit} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSave()}
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        )}
      </div>

      {creatingTask && (
        <div onClick={(e) => e.stopPropagation()}>
          <TaskFormModal
            fixedLead={{ id: lead.id, name: lead.name }}
            onClose={() => setCreatingTask(false)}
            onSaved={() => {
              tasks.reload();
              timeline.reload();
            }}
          />
        </div>
      )}
      {confirmDelete && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            title="Excluir lead?"
            message={`"${lead.name}" e o histórico dele (tarefas, comentários, linha do tempo) serão removidos. Esta ação não pode ser desfeita.`}
            onConfirm={handleDelete}
            onClose={() => setConfirmDelete(false)}
          />
        </div>
      )}
      {confirmDiscard && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            title="Descartar alterações?"
            message={
              confirmDiscard === "close"
                ? "Há alterações ou um comentário ainda não salvos. Se fechar agora, eles serão perdidos."
                : "As alterações feitas neste lead ainda não foram salvas e serão perdidas."
            }
            confirmLabel="Descartar"
            onConfirm={confirmDiscardNow}
            onClose={() => setConfirmDiscard(null)}
          />
        </div>
      )}
      {clientDialog && (
        <div onClick={(e) => e.stopPropagation()}>
          <CreateClientFromLeadDialog lead={lead} onClose={() => setClientDialog(false)} />
        </div>
      )}
      {claimStage && (
        <div onClick={(e) => e.stopPropagation()}>
          <ClaimLeadDialog
            leadName={lead.name}
            nicheName={nicheName}
            stageLabel={pipelineStages.find((s) => s.id === claimStage)?.label ?? "a nova etapa"}
            onClaim={async () => {
              if (await handleClaim()) requestMove(claimStage, false);
              return true;
            }}
            onSkip={async () => {
              requestMove(claimStage, false);
              return true;
            }}
            onClose={() => setClaimStage(null)}
          />
        </div>
      )}
      {confirmLostStage && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmLostDialog
            leadName={lead.name}
            stageLabel={pipelineStages.find((s) => s.id === confirmLostStage)?.label ?? "perdido"}
            onConfirm={() => handleMove(confirmLostStage)}
            onClose={() => setConfirmLostStage(null)}
          />
        </div>
      )}
    </div>
  );
}
