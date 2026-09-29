import { useRef, useState } from "react";
import type { Lead, LeadMessageTemplate, UpdateLeadInput } from "../../types/lead";
import type { PipelineStage } from "../../types/pipeline";
import type { Task } from "../../types/task";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { CurrencyInput } from "../common/CurrencyInput";
import { TaskFormModal } from "../tasks/TaskFormModal";
import { ORIGIN, ORIGIN_KEYS } from "../../constants/origins";
import { brl } from "../../utils/currency";
import { formatDateTime, isOverdue } from "../../utils/datetime";
import { describeTimelineItem, timelineActor } from "../../utils/leadTimeline";
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
import { readableTextColor } from "../../utils/colors";
import { formatPhone } from "../../utils/phone";
import { WhatsappButton } from "./WhatsappButton";
import styles from "./LeadDrawer.module.css";

/**
 * Ficha do lead (Etapa 1) — fluxo comercial completo sem sair daqui:
 * etapa (select = alternativa ao arrastar, essencial no celular), dono
 * (só admin/gestor reatribuem; vendedor vê), dados, tags, tarefas REAIS do
 * lead (criar/concluir), comentário e a timeline comercial REAL
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
  const { update, move, delete: deleteLead } = useLeadActions();
  const { create: createComment } = useLeadCommentActions();
  const { setDone } = useTaskActions();
  const { data: availableTags } = useTags();
  const { data: team } = useTeamDirectory();
  const { data: pipelines } = usePipelines();
  const timeline = useLeadTimeline(lead.id);
  const tasks = useTasks({ scope: "all", leadId: lead.id, page: 1, pageSize: 50 });

  const pipelineStages =
    stages ?? pipelines?.find((p) => p.id === lead.pipelineId)?.stages ?? [];
  const stage = pipelineStages.find((s) => s.id === lead.stageId);
  const ownerName = lead.ownerId
    ? (team?.find((m) => m.id === lead.ownerId)?.name ?? "—")
    : "Sem responsável";

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [form, setForm] = useState(() => fromLead(lead));
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  // Esc/clique fora não descartam edição nem comentário em andamento.
  const hasUnsaved = () => editing || newComment.trim().length > 0;
  useDialog(drawerRef, onClose, hasUnsaved);

  function afterChange(updated: Lead) {
    onSaved?.(updated);
    timeline.reload();
  }

  async function handleMove(stageId: string) {
    if (stageId === lead.stageId) return;
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
    } catch (err) {
      toastError(err, "Não foi possível mover o lead.");
    } finally {
      setMoving(false);
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
      toastError(err, "Não foi possível trocar o responsável.");
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
      toastError(err, "Não foi possível adicionar o comentário");
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
      toastError(err, "Não foi possível atualizar a tarefa.");
    }
  }

  async function handleSave() {
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
      setEditing(false);
    } catch (err) {
      toastError(err, "Não foi possível salvar as alterações");
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

  function toggleTag(tagId: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tagId) ? f.tags.filter((id) => id !== tagId) : [...f.tags, tagId],
    }));
  }

  const taskItems = [...(tasks.data?.items ?? [])].sort(
    (a, b) => Number(a.done) - Number(b.done) || a.dueAt.localeCompare(b.dueAt),
  );

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
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar lead">
          ✕
        </button>

        <div className={styles.header}>
          <Avatar name={lead.name} bg="var(--tone-blue-bg)" color="var(--tone-blue)" size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <>
                <input
                  className={styles.editInput}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nome"
                  aria-label="Nome"
                />
                <input
                  className={styles.editInput}
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Empresa"
                  aria-label="Empresa"
                />
              </>
            ) : (
              <>
                <div className={styles.name}>{lead.name}</div>
                <div className={styles.company}>{lead.company || lead.role}</div>
              </>
            )}
          </div>
        </div>

        <div className={styles.badges}>
          {stage && (
            <Badge
              label={stage.isWon ? `🏆 ${stage.label}` : stage.label}
              color={stage.color}
              bg="var(--tone-gray-bg)"
            />
          )}
          <WhatsappButton lead={lead} templates={templates} />
          {!editing && (
            <button className={styles.editToggle} onClick={() => (setForm(fromLead(lead)), setEditing(true))}>
              ✎ Editar
            </button>
          )}
        </div>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Etapa</span>
            <select
              className={styles.editInputSmall}
              value={lead.stageId}
              disabled={moving || pipelineStages.length === 0}
              onChange={(e) => void handleMove(e.target.value)}
            >
              {!stage && <option value={lead.stageId}>—</option>}
              {pipelineStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.isWon ? " (ganho)" : s.isLost ? " (perdido)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Responsável</span>
            {canAssign ? (
              <select
                className={styles.editInputSmall}
                value={lead.ownerId ?? ""}
                disabled={assigning || !team}
                onChange={(e) => void handleAssign(e.target.value)}
              >
                {!lead.ownerId && <option value="">Sem responsável</option>}
                {lead.ownerId && !team?.some((m) => m.id === lead.ownerId) && (
                  <option value={lead.ownerId}>Usuário inativo</option>
                )}
                {team?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className={styles.fieldValue}>{ownerName}</div>
            )}
          </label>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Valor</div>
            {editing ? (
              <CurrencyInput
                className={styles.editInputSmall}
                value={form.value}
                onChange={(v) => setForm((f) => ({ ...f, value: v }))}
              />
            ) : (
              <div className={styles.fieldValue}>R$ {brl(lead.value)}</div>
            )}
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Probabilidade</div>
            {editing ? (
              <input
                className={styles.editInputSmall}
                type="number"
                min={0}
                max={100}
                value={form.probability}
                onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
              />
            ) : (
              <div className={styles.fieldValue}>{lead.probability}%</div>
            )}
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Telefone</div>
            {editing ? (
              <input
                className={styles.editInputSmall}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
              />
            ) : (
              <div className={styles.fieldValue}>{lead.phone || "—"}</div>
            )}
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>E-mail</div>
            {editing ? (
              <input
                className={styles.editInputSmall}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            ) : (
              <div className={styles.fieldValue}>{lead.email || "—"}</div>
            )}
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Origem</div>
            {editing ? (
              <select
                className={styles.editInputSmall}
                value={form.origin}
                onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
              >
                {!ORIGIN_KEYS.some((k) => k === form.origin) && (
                  <option value={form.origin}>{form.origin || "—"}</option>
                )}
                {ORIGIN_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {ORIGIN[k].label}
                  </option>
                ))}
              </select>
            ) : (
              <div className={styles.fieldValue}>
                {ORIGIN_KEYS.some((k) => k === lead.origin)
                  ? ORIGIN[lead.origin as (typeof ORIGIN_KEYS)[number]].label
                  : lead.origin || "—"}
              </div>
            )}
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Criado em</div>
            <div className={styles.fieldValue}>{formatDateTime(lead.createdAt)}</div>
          </div>
        </div>

        {(editing ? availableTags && availableTags.length > 0 : lead.tags.length > 0) && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Tags</div>
            <div className={styles.tagOptions}>
              {editing
                ? availableTags?.map((tag) => {
                    const active = form.tags.includes(tag.id);
                    return (
                      <button
                        type="button"
                        key={tag.id}
                        className={
                          active ? `${styles.tagOption} ${styles.tagOptionActive}` : styles.tagOption
                        }
                        style={
                          active ? { color: readableTextColor(tag.color), background: tag.bg } : undefined
                        }
                        onClick={() => toggleTag(tag.id)}
                        aria-pressed={active}
                      >
                        {tag.label}
                      </button>
                    );
                  })
                : lead.tags.map((tagId) => {
                    const tag = availableTags?.find((t) => t.id === tagId);
                    return tag ? (
                      <Badge key={tag.id} label={tag.label} color={tag.color} bg={tag.bg} />
                    ) : null;
                  })}
            </div>
          </div>
        )}

        {editing ? (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Notas</div>
            <textarea
              className={styles.editTextarea}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={4}
              placeholder="Anotações sobre o lead…"
            />
          </div>
        ) : (
          lead.notes && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Notas</div>
              <p className={styles.notes}>{lead.notes}</p>
            </div>
          )
        )}

        {editing && (
          <div className={styles.editActions}>
            <Button onClick={() => setEditing(false)} disabled={saving}>
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

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Tarefas</div>
            <button type="button" className={styles.editToggle} onClick={() => setCreatingTask(true)}>
              + Nova tarefa
            </button>
          </div>
          {tasks.loading && !tasks.data && <div className={styles.empty}>Carregando…</div>}
          {tasks.error && <div className={styles.empty}>Não foi possível carregar as tarefas.</div>}
          {tasks.data && taskItems.length === 0 && (
            <div className={styles.empty}>Nenhuma tarefa para este lead.</div>
          )}
          {taskItems.map((t) => (
            <div key={t.id} className={styles.taskRow}>
              <button
                type="button"
                className={styles.taskCheck}
                onClick={() => void handleToggleTask(t)}
                aria-label={t.done ? "Reabrir tarefa" : "Concluir tarefa"}
              >
                {t.done ? "☑" : "☐"}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={t.done ? styles.taskDone : undefined}>{t.title}</div>
                <div
                  className={
                    isOverdue(t.dueAt, t.done) ? `${styles.taskMeta} ${styles.overdue}` : styles.taskMeta
                  }
                >
                  {isOverdue(t.dueAt, t.done) ? "Atrasada · " : ""}
                  {formatDateTime(t.dueAt)}
                  {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                </div>
              </div>
            </div>
          ))}
          {tasks.data && tasks.data.total > taskItems.length && (
            <div className={styles.empty}>
              Mostrando {taskItems.length} de {tasks.data.total} — veja todas em Tarefas.
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Atividades</div>
          <div className={styles.commentForm}>
            <textarea
              className={styles.editTextarea}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              placeholder="Registrar um comentário/follow-up…"
              aria-label="Novo comentário"
            />
            <Button
              variant="primary"
              onClick={() => void handlePostComment()}
              disabled={postingComment || !newComment.trim()}
            >
              {postingComment ? "Enviando…" : "Comentar"}
            </Button>
          </div>
          {timeline.loading && !timeline.data && <div className={styles.empty}>Carregando…</div>}
          {timeline.error && (
            <div className={styles.empty}>
              Não foi possível carregar a linha do tempo.{" "}
              <button type="button" className={styles.editToggle} onClick={timeline.reload}>
                Tentar de novo
              </button>
            </div>
          )}
          {timeline.data?.length === 0 && (
            <div className={styles.empty}>Sem atividades registradas ainda.</div>
          )}
          {timeline.data?.map((item) => {
            const view = describeTimelineItem(item);
            return (
              <div key={`${item.type}-${item.id}`} className={styles.timelineRow}>
                <span className={styles.timelineIcon} aria-hidden="true">
                  {view.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className={styles.timelineTitle}>{view.title}</div>
                  {view.detail && <div className={styles.timelineDesc}>{view.detail}</div>}
                  <div className={styles.timelineWho}>
                    {timelineActor(item)} · {formatDateTime(item.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.dangerZone}>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Excluir lead
          </Button>
        </div>
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
    </div>
  );
}

function fromLead(lead: Lead) {
  return {
    name: lead.name,
    company: lead.company,
    phone: lead.phone,
    email: lead.email,
    value: lead.value,
    probability: String(lead.probability),
    origin: lead.origin,
    notes: lead.notes,
    tags: lead.tags,
  };
}
