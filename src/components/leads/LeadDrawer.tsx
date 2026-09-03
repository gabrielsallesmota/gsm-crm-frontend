import { useState } from "react";
import type { Lead, LeadMessageTemplate, UpdateLeadInput } from "../../types/lead";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { STAGES } from "../../constants/stages";
import { TEMP } from "../../constants/temperature";
import { brl } from "../../utils/currency";
import { useLeadActions } from "../../hooks/useLeadActions";
import { useTags } from "../../hooks/useTags";
import { useLeadComments } from "../../hooks/useLeadComments";
import { useLeadCommentActions } from "../../hooks/useLeadCommentActions";
import { useToast } from "../../hooks/useToast";
import { formatPhone } from "../../utils/phone";
import { WhatsappButton } from "./WhatsappButton";
import styles from "./LeadDrawer.module.css";

export function LeadDrawer({
  lead,
  templates = [],
  onClose,
  onSaved,
}: {
  lead: Lead;
  /** Opcional: só quem já carregou os templates (Pipeline) passa isso — a
   * tela de lista de leads simplesmente não mostra o botão de WhatsApp. */
  templates?: LeadMessageTemplate[];
  onClose: () => void;
  onSaved?: (lead: Lead) => void;
}) {
  const { toast } = useToast();
  const { update } = useLeadActions();
  const { data: availableTags } = useTags();
  const { data: comments, reload: reloadComments } = useLeadComments(lead.id);
  const { create: createComment } = useLeadCommentActions();
  const stage = STAGES[lead.stage];
  const temp = TEMP[lead.temperature];

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => fromLead(lead));
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  async function handlePostComment() {
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      await createComment(lead.id, newComment.trim());
      setNewComment("");
      reloadComments();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível adicionar o comentário");
    } finally {
      setPostingComment(false);
    }
  }

  function toggleTag(tagId: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tagId) ? f.tags.filter((id) => id !== tagId) : [...f.tags, tagId],
    }));
  }

  function startEdit() {
    setForm(fromLead(lead));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
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
        notes: form.notes,
        tags: form.tags,
      };
      const updated = await update(lead.id, input);
      toast("Lead atualizado com sucesso");
      onSaved?.(updated);
      setEditing(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar as alterações");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Fechar">
          ✕
        </button>

        <div className={styles.header}>
          <Avatar name={lead.name} bg="rgba(74,163,255,.14)" color="#4aa3ff" size={48} />
          <div style={{ flex: 1 }}>
            {editing ? (
              <>
                <input
                  className={styles.editInput}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nome"
                />
                <input
                  className={styles.editInput}
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Empresa"
                />
              </>
            ) : (
              <>
                <div className={styles.name}>{lead.name}</div>
                <div className={styles.company}>{lead.company !== "—" ? lead.company : lead.role}</div>
              </>
            )}
          </div>
        </div>

        <div className={styles.badges}>
          <Badge label={stage.label} color={stage.color} bg={stage.bg} />
          <Badge label={temp.label} color={temp.color} bg="rgba(255,255,255,.06)" />
          <WhatsappButton lead={lead} templates={templates} />
          {!editing && (
            <button className={styles.editToggle} onClick={startEdit}>
              ✎ Editar
            </button>
          )}
        </div>

        <div className={styles.grid}>
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
        </div>

        {(editing ? availableTags && availableTags.length > 0 : lead.tags.length > 0) && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Tags</div>
            {editing ? (
              <div className={styles.tagOptions}>
                {availableTags?.map((tag) => {
                  const active = form.tags.includes(tag.id);
                  return (
                    <button
                      type="button"
                      key={tag.id}
                      className={active ? `${styles.tagOption} ${styles.tagOptionActive}` : styles.tagOption}
                      style={active ? { color: tag.color, background: tag.bg } : undefined}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.tagOptions}>
                {lead.tags.map((tagId) => {
                  const tag = availableTags?.find((t) => t.id === tagId);
                  return tag ? <Badge key={tag.id} label={tag.label} color={tag.color} bg={tag.bg} /> : null;
                })}
              </div>
            )}
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
            <Button onClick={cancelEdit} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={saving || !form.name.trim()}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        )}

        {(lead.aiSummary || lead.aiNext) && (
          <div className={styles.aiBox}>
            {lead.aiSummary && <p className={styles.aiSummary}>{lead.aiSummary}</p>}
            {lead.aiNext && (
              <p className={styles.aiNext}>
                <strong>Próximo passo:</strong> {lead.aiNext}
              </p>
            )}
          </div>
        )}

        {lead.tasks.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Tarefas</div>
            {lead.tasks.map((t) => (
              <div key={t.id} className={styles.taskRow}>
                <span>{t.done ? "☑" : "☐"}</span>
                <span className={t.done ? styles.taskDone : undefined}>{t.title}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Comentários</div>
          <div className={styles.commentForm}>
            <textarea
              className={styles.editTextarea}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              placeholder="Deixe um comentário sobre este lead…"
            />
            <Button
              variant="primary"
              onClick={() => void handlePostComment()}
              disabled={postingComment || !newComment.trim()}
            >
              {postingComment ? "Enviando…" : "Comentar"}
            </Button>
          </div>
          {comments?.length === 0 && <div className={styles.empty}>Nenhum comentário ainda.</div>}
          {comments?.map((c) => (
            <div key={c.id} className={styles.commentRow}>
              <div className={styles.commentMeta}>
                <span className={styles.commentAuthor}>{c.authorName}</span>
                <span className={styles.commentDate}>{new Date(c.createdAt).toLocaleString("pt-BR")}</span>
              </div>
              <p className={styles.commentText}>{c.text}</p>
            </div>
          ))}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Linha do tempo</div>
          {lead.timeline.length === 0 && <div className={styles.empty}>Sem atividades registradas ainda.</div>}
          {lead.timeline.map((t, i) => (
            <div key={i} className={styles.timelineRow}>
              <span className={styles.timelineIcon} style={{ color: t.color }}>
                {t.icon}
              </span>
              <div>
                <div className={styles.timelineTitle}>{t.title}</div>
                <div className={styles.timelineDesc}>{t.desc}</div>
                <div className={styles.timelineWho}>{t.who}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fromLead(lead: Lead) {
  return {
    name: lead.name,
    company: lead.company === "—" ? "" : lead.company,
    phone: lead.phone,
    email: lead.email,
    value: lead.value,
    probability: String(lead.probability),
    notes: lead.notes,
    tags: lead.tags,
  };
}
