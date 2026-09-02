import { useState } from "react";
import type { MessageTemplate, Prospect, ProspectStage, UpdateProspectInput } from "../../types/prospect";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { WhatsappButton } from "./WhatsappButton";
import { useProspectActions } from "../../hooks/useProspectActions";
import { useProspectComments } from "../../hooks/useProspectComments";
import { useProspectCommentActions } from "../../hooks/useProspectCommentActions";
import { EmptyState } from "../common/EmptyState";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../types/common";
import {
  PAGE_OBJECTIVE,
  PHONE_TYPE,
  PRIORITY,
  PROSPECT_ORIGIN,
  SITE_STATUS,
  WHATSAPP_STATUS,
} from "../../constants/prospectEnums";
import styles from "./ProspectDrawer.module.css";

type FormState = ReturnType<typeof fromProspect>;

export function ProspectDrawer({
  prospect,
  stages,
  templates,
  onClose,
  onSaved,
  onDeleted,
}: {
  prospect: Prospect;
  stages: ProspectStage[];
  templates: MessageTemplate[];
  onClose: () => void;
  onSaved?: (prospect: Prospect) => void;
  onDeleted?: () => void;
}) {
  const { toast } = useToast();
  const { update, move, delete: deleteProspect } = useProspectActions();
  const { data: comments, notImplemented: commentsNotImplemented, reload: reloadComments } =
    useProspectComments(prospect.id);
  const { create: createComment } = useProspectCommentActions();
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  async function handlePostComment() {
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      await createComment(prospect.id, newComment.trim());
      setNewComment("");
      reloadComments();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível adicionar o comentário");
    } finally {
      setPostingComment(false);
    }
  }
  const stage = stages.find((s) => s.id === prospect.stageId);
  const priority = PRIORITY[prospect.priority];
  const origin = PROSPECT_ORIGIN[prospect.origin];

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [duplicateBlock, setDuplicateBlock] = useState<{ companyName: string } | null>(null);
  const [form, setForm] = useState<FormState>(() => fromProspect(prospect));

  function startEdit() {
    setForm(fromProspect(prospect));
    setDuplicateBlock(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDuplicateBlock(null);
    setEditing(false);
  }

  async function handleSave(force = false) {
    setSaving(true);
    setDuplicateBlock(null);
    try {
      const input: UpdateProspectInput = {
        companyName: form.companyName.trim(),
        niche: form.niche,
        mainService: form.mainService,
        city: form.city,
        neighborhood: form.neighborhood,
        googleMapsUrl: form.googleMapsUrl,
        phoneRaw: form.phoneRaw,
        phoneType: form.phoneType,
        whatsappStatus: form.whatsappStatus,
        websiteUrl: form.websiteUrl,
        siteStatus: form.siteStatus,
        instagram: form.instagram,
        positiveNote: form.positiveNote,
        opportunity: form.opportunity,
        priority: form.priority,
        origin: form.origin,
        force,
        ...(form.message1 ? { message1: form.message1 } : {}),
        ...(form.message2 ? { message2: form.message2 } : {}),
        ...(form.message3 ? { message3: form.message3 } : {}),
        ...(form.message4 ? { message4: form.message4 } : {}),
        ...(form.initialContactDate ? { initialContactDate: form.initialContactDate } : {}),
        ...(form.targetDate ? { targetDate: form.targetDate } : {}),
        ...(form.googleRating ? { googleRating: Number(form.googleRating) } : {}),
        ...(form.googleReviewsCount ? { googleReviewsCount: Number(form.googleReviewsCount) } : {}),
        ...(form.pageObjective
          ? { pageObjective: form.pageObjective as NonNullable<UpdateProspectInput["pageObjective"]> }
          : {}),
      };
      const updated = await update(prospect.id, input);
      toast("Prospect atualizado com sucesso");
      onSaved?.(updated);
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDuplicateBlock({ companyName: form.companyName });
      } else {
        toast(err instanceof Error ? err.message : "Não foi possível salvar as alterações");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveStage(stageId: string) {
    try {
      const updated = await move(prospect.id, stageId);
      onSaved?.(updated);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível mover o estágio");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteProspect(prospect.id);
      toast("Prospect excluído");
      onDeleted?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível excluir");
      setDeleting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Fechar" type="button">
          ✕
        </button>

        <div className={styles.header}>
          <div style={{ flex: 1 }}>
            <div className={styles.seq}>LEAD-{String(prospect.sequenceNumber).padStart(4, "0")}</div>
            {editing ? (
              <input
                className={styles.editInput}
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                placeholder="Nome da empresa"
              />
            ) : (
              <div className={styles.name}>{prospect.companyName}</div>
            )}
          </div>
        </div>

        <div className={styles.badges}>
          {stage && (
            <select
              className={styles.stageSelect}
              value={prospect.stageId}
              onChange={(e) => void handleMoveStage(e.target.value)}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <Badge label={`Prioridade ${priority.label}`} color={priority.color} bg={priority.bg} />
          <Badge label={origin.label} color={origin.color} bg={origin.bg} />
          <WhatsappButton prospect={prospect} stage={stage} templates={templates} />
          {!editing && (
            <button className={styles.editToggle} onClick={startEdit} type="button">
              ✎ Editar
            </button>
          )}
        </div>

        {duplicateBlock && (
          <div className={styles.duplicateWarning}>
            Já existe outro prospect cadastrado com esse telefone.
            <div className={styles.duplicateActions}>
              <Button onClick={() => setDuplicateBlock(null)} disabled={saving}>
                Revisar telefone
              </Button>
              <Button variant="primary" onClick={() => void handleSave(true)} disabled={saving}>
                Salvar mesmo assim
              </Button>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Identificação</div>
          <div className={styles.grid}>
            <Field
              label="Categoria/nicho"
              editing={editing}
              value={form.niche}
              display={prospect.niche}
              onChange={(v) => setForm((f) => ({ ...f, niche: v }))}
            />
            <Field
              label="Serviço principal"
              editing={editing}
              value={form.mainService}
              display={prospect.mainService}
              onChange={(v) => setForm((f) => ({ ...f, mainService: v }))}
            />
            <Field
              label="Cidade"
              editing={editing}
              value={form.city}
              display={prospect.city}
              onChange={(v) => setForm((f) => ({ ...f, city: v }))}
            />
            <Field
              label="Bairro"
              editing={editing}
              value={form.neighborhood}
              display={prospect.neighborhood}
              onChange={(v) => setForm((f) => ({ ...f, neighborhood: v }))}
            />
            <SelectField
              label="Origem"
              editing={editing}
              value={form.origin}
              display={origin.label}
              options={Object.entries(PROSPECT_ORIGIN).map(([k, v]) => ({ value: k, label: v.label }))}
              onChange={(v) => setForm((f) => ({ ...f, origin: v as FormState["origin"] }))}
            />
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <div className={styles.fieldLabel}>Link do Google Maps</div>
              {editing ? (
                <input
                  className={styles.fieldInput}
                  value={form.googleMapsUrl}
                  onChange={(e) => setForm((f) => ({ ...f, googleMapsUrl: e.target.value }))}
                />
              ) : prospect.googleMapsUrl ? (
                <div className={styles.fieldValue}>
                  <a href={prospect.googleMapsUrl} target="_blank" rel="noreferrer">
                    Abrir no Maps
                  </a>
                </div>
              ) : (
                <div className={styles.fieldValue}>—</div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Contato</div>
          <div className={styles.grid}>
            <Field
              label="Telefone"
              editing={editing}
              value={form.phoneRaw}
              display={prospect.phoneRaw}
              onChange={(v) => setForm((f) => ({ ...f, phoneRaw: v }))}
            />
            <SelectField
              label="Tipo de telefone"
              editing={editing}
              value={form.phoneType}
              display={PHONE_TYPE[prospect.phoneType].label}
              options={Object.entries(PHONE_TYPE).map(([k, v]) => ({ value: k, label: v.label }))}
              onChange={(v) => setForm((f) => ({ ...f, phoneType: v as FormState["phoneType"] }))}
            />
            <SelectField
              label="Status do WhatsApp"
              editing={editing}
              value={form.whatsappStatus}
              display={WHATSAPP_STATUS[prospect.whatsappStatus].label}
              options={Object.entries(WHATSAPP_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
              onChange={(v) => setForm((f) => ({ ...f, whatsappStatus: v as FormState["whatsappStatus"] }))}
            />
            <Field
              label="Instagram"
              editing={editing}
              value={form.instagram}
              display={prospect.instagram}
              onChange={(v) => setForm((f) => ({ ...f, instagram: v }))}
            />
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <div className={styles.fieldLabel}>Site encontrado</div>
              {editing ? (
                <input
                  className={styles.fieldInput}
                  value={form.websiteUrl}
                  onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                />
              ) : prospect.websiteUrl ? (
                <div className={styles.fieldValue}>
                  <a href={prospect.websiteUrl} target="_blank" rel="noreferrer">
                    {prospect.websiteUrl}
                  </a>
                </div>
              ) : (
                <div className={styles.fieldValue}>—</div>
              )}
            </div>
            <SelectField
              label="Status do site"
              editing={editing}
              value={form.siteStatus}
              display={SITE_STATUS[prospect.siteStatus].label}
              options={Object.entries(SITE_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
              onChange={(v) => setForm((f) => ({ ...f, siteStatus: v as FormState["siteStatus"] }))}
            />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Avaliação no Google</div>
          <div className={styles.grid}>
            <Field
              label="Nota"
              editing={editing}
              value={form.googleRating}
              display={prospect.googleRating != null ? String(prospect.googleRating) : "—"}
              onChange={(v) => setForm((f) => ({ ...f, googleRating: v }))}
              type="number"
            />
            <Field
              label="Qtd. de avaliações"
              editing={editing}
              value={form.googleReviewsCount}
              display={prospect.googleReviewsCount != null ? String(prospect.googleReviewsCount) : "—"}
              onChange={(v) => setForm((f) => ({ ...f, googleReviewsCount: v }))}
              type="number"
            />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Oportunidade</div>
          <div className={styles.grid}>
            <SelectField
              label="Objetivo da página"
              editing={editing}
              value={form.pageObjective}
              display={prospect.pageObjective ? PAGE_OBJECTIVE[prospect.pageObjective].label : "—"}
              options={[
                { value: "", label: "—" },
                ...Object.entries(PAGE_OBJECTIVE).map(([k, v]) => ({ value: k, label: v.label })),
              ]}
              onChange={(v) => setForm((f) => ({ ...f, pageObjective: v as FormState["pageObjective"] }))}
            />
            <SelectField
              label="Prioridade"
              editing={editing}
              value={form.priority}
              display={priority.label}
              options={Object.entries(PRIORITY).map(([k, v]) => ({ value: k, label: v.label }))}
              onChange={(v) => setForm((f) => ({ ...f, priority: v as FormState["priority"] }))}
            />
            <Field
              label="Primeiro contato (P0)"
              editing={editing}
              value={form.initialContactDate}
              display={formatTargetDate(prospect.initialContactDate)}
              onChange={(v) => setForm((f) => ({ ...f, initialContactDate: v }))}
              type="date"
            />
            <Field
              label="Data alvo (follow-up)"
              editing={editing}
              value={form.targetDate}
              display={formatTargetDate(prospect.targetDate)}
              onChange={(v) => setForm((f) => ({ ...f, targetDate: v }))}
              type="date"
            />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Observação positiva</div>
          {editing ? (
            <textarea
              className={styles.textarea}
              rows={3}
              value={form.positiveNote}
              onChange={(e) => setForm((f) => ({ ...f, positiveNote: e.target.value }))}
              placeholder="Algo bom que você notou sobre a empresa…"
            />
          ) : (
            <p className={styles.notes}>{prospect.positiveNote || "—"}</p>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Oportunidade identificada</div>
          {editing ? (
            <textarea
              className={styles.textarea}
              rows={3}
              value={form.opportunity}
              onChange={(e) => setForm((f) => ({ ...f, opportunity: e.target.value }))}
              placeholder="O que essa empresa precisa que a GSM pode resolver…"
            />
          ) : (
            <p className={styles.notes}>{prospect.opportunity || "—"}</p>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Mensagens do WhatsApp</div>
          <p className={styles.notes} style={{ marginBottom: 8 }}>
            Uma mensagem própria por campo — configure em "Estágios" qual campo cada estágio usa no
            lugar do template padrão. Aceita os mesmos placeholders (
            {"{empresa}, {nicho}, {servico_principal}, {cidade}, {bairro}, {avaliacao_google}"}).
          </p>
          {(["message1", "message2", "message3", "message4"] as const).map((key, i) => (
            <div key={key} className={styles.field} style={{ marginBottom: 10 }}>
              <div className={styles.fieldLabel}>Mensagem {i + 1}</div>
              {editing ? (
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={`Texto da mensagem ${i + 1}…`}
                />
              ) : (
                <p className={styles.notes}>{prospect[key] || "—"}</p>
              )}
            </div>
          ))}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Comentários</div>
          {commentsNotImplemented ? (
            <EmptyState
              title="Não disponível no modo Demonstração"
              message="Prospecção GSM é uma área interna, sem dados fictícios para mostrar aqui."
            />
          ) : (
            <>
            <div className={styles.commentForm}>
              <textarea
                className={styles.textarea}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                placeholder="Deixe um comentário sobre este prospect…"
              />
              <Button
                variant="primary"
                onClick={() => void handlePostComment()}
                disabled={postingComment || !newComment.trim()}
              >
                {postingComment ? "Enviando…" : "Comentar"}
              </Button>
            </div>
            {comments?.length === 0 && <div className={styles.notes}>Nenhum comentário ainda.</div>}
            {comments?.map((c) => (
              <div key={c.id} className={styles.commentRow}>
                <div className={styles.commentMeta}>
                  <span className={styles.commentAuthor}>{c.authorName}</span>
                  <span className={styles.commentDate}>
                    {new Date(c.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className={styles.notes}>{c.text}</p>
              </div>
            ))}
            </>
          )}
        </div>

        {editing && (
          <div className={styles.editActions}>
            <Button
              variant="danger"
              onClick={() => setConfirmingDelete(true)}
              disabled={saving || deleting}
            >
              Excluir
            </Button>
            <div className={styles.editActionsRight}>
              <Button onClick={cancelEdit} disabled={saving}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSave(false)}
                disabled={saving || !form.companyName.trim()}
              >
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </div>
        )}

        {confirmingDelete && (
          <div className={styles.duplicateWarning}>
            Excluir "{prospect.companyName}" definitivamente? Essa ação não pode ser desfeita.
            <div className={styles.duplicateActions}>
              <Button onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? "Excluindo…" : "Excluir definitivamente"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  editing,
  value,
  display,
  onChange,
  type = "text",
}: {
  label: string;
  editing: boolean;
  value: string;
  display: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      {editing ? (
        <input
          className={styles.fieldInput}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className={styles.fieldValue}>{display || "—"}</div>
      )}
    </div>
  );
}

function SelectField({
  label,
  editing,
  value,
  display,
  options,
  onChange,
}: {
  label: string;
  editing: boolean;
  value: string;
  display: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      {editing ? (
        <select className={styles.fieldSelect} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <div className={styles.fieldValue}>{display}</div>
      )}
    </div>
  );
}

/** "2026-08-27" → "27/08/2026" — só pro modo leitura; em edição o campo é
 * um `<input type="date">` nativo, que já cuida do próprio formato. */
function formatTargetDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function fromProspect(prospect: Prospect) {
  return {
    companyName: prospect.companyName,
    niche: prospect.niche,
    mainService: prospect.mainService,
    city: prospect.city,
    neighborhood: prospect.neighborhood,
    googleMapsUrl: prospect.googleMapsUrl,
    phoneRaw: prospect.phoneRaw,
    phoneType: prospect.phoneType,
    whatsappStatus: prospect.whatsappStatus,
    websiteUrl: prospect.websiteUrl,
    siteStatus: prospect.siteStatus,
    instagram: prospect.instagram,
    googleRating: prospect.googleRating != null ? String(prospect.googleRating) : "",
    googleReviewsCount: prospect.googleReviewsCount != null ? String(prospect.googleReviewsCount) : "",
    positiveNote: prospect.positiveNote,
    opportunity: prospect.opportunity,
    pageObjective: prospect.pageObjective ?? "",
    priority: prospect.priority,
    origin: prospect.origin,
    message1: prospect.message1,
    message2: prospect.message2,
    message3: prospect.message3,
    message4: prospect.message4,
    initialContactDate: prospect.initialContactDate ?? "",
    targetDate: prospect.targetDate ?? "",
  };
}
