import { useState } from "react";
import { usePipelines } from "../../hooks/usePipelines";
import { useLeadMessageTemplates } from "../../hooks/useLeadMessageTemplates";
import { useLeadMessageTemplateActions } from "../../hooks/useLeadMessageTemplateActions";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../types/common";
import { ORIGIN, ORIGIN_KEYS, originOf } from "../../constants/origins";
import type { Pipeline } from "../../types/pipeline";
import type { LeadMessageTemplate } from "../../types/lead";
import styles from "../prospects/MessageTemplatesSettings.module.css";

const WILDCARD_BADGE = { label: "Qualquer origem", color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" };

function submitButtonLabel(submitting: boolean, isEditing: boolean): string {
  if (submitting) return "Salvando…";
  return isEditing ? "Salvar alterações" : "Adicionar template";
}

/** Etapa pelo UUID REAL (Etapa 1) — o template aponta direto para a etapa. */
function stageLabelFor(stageId: string, pipelines: Pipeline[]): string {
  for (const pipeline of pipelines) {
    const stage = pipeline.stages.find((s) => s.id === stageId);
    if (stage) return pipelines.length > 1 ? `${pipeline.name} — ${stage.label}` : stage.label;
  }
  return "Etapa removida";
}

/**
 * Configuração de mensagens padrão de WhatsApp por (estágio do pipeline,
 * origem do lead) — ver `utils/leadMessageTemplates.ts` pro motor de
 * substituição. Quem decide se isso é renderizado é `SettingsPage.tsx`
 * (aberto pra qualquer usuário do tenant, só criar/editar/excluir é
 * restrito a admin/gestor — mesmo gate de `require_roles` no backend).
 */
export function LeadMessageTemplatesSettings() {
  const { data: pipelines, loading: loadingPipelines, error: pipelinesError } = usePipelines();
  const { data: templates, loading: loadingTemplates, error, reload } = useLeadMessageTemplates();
  const { delete: deleteTemplate } = useLeadMessageTemplateActions();
  const { toast, toastError } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    try {
      await deleteTemplate(id);
      toast("Template excluído");
      reload();
    } catch (err) {
      toastError(err, "Não foi possível excluir o template");
    }
  }

  if (pipelinesError) {
    return <EmptyState title="Não foi possível carregar os pipelines" message={pipelinesError.message} />;
  }
  if (error) {
    return <EmptyState title="Não foi possível carregar os templates" message={error.message} />;
  }
  if (loadingPipelines || loadingTemplates) return <div className={styles.hint}>Carregando…</div>;

  const pipelineList = pipelines ?? [];
  const templateList = templates ?? [];

  return (
    <div>
      <p className={styles.hint}>
        Mensagem padrão de WhatsApp por estágio do pipeline + origem do lead. Deixe "origem" em
        branco para criar o template coringa desse estágio (usado quando não existe um específico
        pra origem do lead). Placeholders disponíveis: <code>{"{nome}"}</code>{" "}
        <code>{"{empresa}"}</code> <code>{"{cidade}"}</code> <code>{"{estado}"}</code>
      </p>

      {pipelineList.length === 0 ? (
        <EmptyState
          title="Nenhum pipeline cadastrado ainda"
          message="Crie um pipeline acima antes de configurar mensagens."
        />
      ) : (
        <TemplateForm pipelines={pipelineList} onSaved={reload} />
      )}

      <div className={styles.list}>
        {templateList.map((template) =>
          editingId === template.id ? (
            <TemplateForm
              key={template.id}
              pipelines={pipelineList}
              existing={template}
              onSaved={() => {
                setEditingId(null);
                reload();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={template.id} className={styles.row}>
              <div className={styles.rowTop}>
                <span className={styles.stageName}>{stageLabelFor(template.stageId, pipelineList)}</span>
                {template.origin ? (
                  <Badge
                    label={originOf(template.origin).label}
                    color={originOf(template.origin).color}
                    bg={originOf(template.origin).bg}
                  />
                ) : (
                  <Badge {...WILDCARD_BADGE} />
                )}
                <div className={styles.rowActions}>
                  <button className={styles.linkBtn} type="button" onClick={() => setEditingId(template.id)}>
                    Editar
                  </button>
                  <button
                    className={styles.linkBtn}
                    type="button"
                    onClick={() => void handleDelete(template.id)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <p className={styles.message}>{template.message}</p>
            </div>
          ),
        )}
        {templateList.length === 0 && (
          <div className={styles.hint}>Nenhum template cadastrado ainda.</div>
        )}
      </div>
    </div>
  );
}

function TemplateForm({
  pipelines,
  existing,
  onSaved,
  onCancel,
}: {
  pipelines: Pipeline[];
  existing?: LeadMessageTemplate;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { create, update } = useLeadMessageTemplateActions();
  const { toast, toastError } = useToast();

  const [stageId, setStageId] = useState(existing?.stageId ?? pipelines[0]?.stages[0]?.id ?? "");
  const [origin, setOrigin] = useState(existing?.origin ?? "");
  const [message, setMessage] = useState(existing?.message ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errorNote, setErrorNote] = useState("");

  async function handleSubmit() {
    if (!stageId || !message.trim()) {
      toast("Escolha a etapa e escreva a mensagem.", "warning");
      return;
    }
    setSubmitting(true);
    setErrorNote("");
    try {
      if (existing) {
        await update(existing.id, { origin: origin || null, message: message.trim() });
      } else {
        await create({ stageId, message: message.trim(), ...(origin ? { origin } : {}) });
        setOrigin("");
        setMessage("");
      }
      toast(existing ? "Template atualizado" : "Template criado");
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrorNote(err.message);
      } else {
        toastError(err, "Não foi possível salvar o template");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.form}>
      <div className={styles.formRow}>
        <select
          className={styles.select}
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          disabled={Boolean(existing)}
        >
          {pipelines.flatMap((p) =>
            p.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {pipelines.length > 1 ? `${p.name} — ${s.label}` : s.label}
              </option>
            )),
          )}
        </select>
        <select className={styles.select} value={origin} onChange={(e) => setOrigin(e.target.value)}>
          <option value="">Qualquer origem (coringa)</option>
          {ORIGIN_KEYS.map((key) => (
            <option key={key} value={key}>
              {ORIGIN[key].label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className={styles.textarea}
        rows={3}
        placeholder="Olá {nome}, tudo bem? Vi seu contato pela {empresa}…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {errorNote && <p className={styles.errorNote}>{errorNote}</p>}
      <div className={styles.formActions}>
        {onCancel && (
          <Button onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={submitting || !message.trim()}
        >
          {submitButtonLabel(submitting, Boolean(existing))}
        </Button>
      </div>
    </div>
  );
}
