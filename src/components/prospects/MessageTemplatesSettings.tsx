import { useState } from "react";
import { useProspectStages } from "../../hooks/useProspectStages";
import { useMessageTemplates } from "../../hooks/useMessageTemplates";
import { useMessageTemplateActions } from "../../hooks/useMessageTemplateActions";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../types/common";
import type { MessageTemplate } from "../../types/prospect";
import styles from "./MessageTemplatesSettings.module.css";

const WILDCARD_BADGE = { label: "Qualquer área", color: "#9aa6b2", bg: "rgba(255,255,255,.06)" };

function submitButtonLabel(submitting: boolean, isEditing: boolean): string {
  if (submitting) return "Salvando…";
  return isEditing ? "Salvar alterações" : "Adicionar template";
}

/**
 * Configuração de mensagens padrão de WhatsApp por (estágio, área) —
 * ver `utils/messageTemplates.ts` pro motor de substituição. Só faz
 * sentido pra super admin (é sobre a carteira de prospecção da GSM), quem
 * decide se isso é renderizado é `SettingsPage.tsx`.
 */
export function MessageTemplatesSettings() {
  const { data: stages, loading: loadingStages, error: stagesError } = useProspectStages();
  const { data: templates, loading: loadingTemplates, error, reload } = useMessageTemplates();
  const { delete: deleteTemplate } = useMessageTemplateActions();
  const { toast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    try {
      await deleteTemplate(id);
      toast("Template excluído");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível excluir o template");
    }
  }

  if (stagesError) {
    return <EmptyState title="Não foi possível carregar os estágios" message={stagesError.message} />;
  }
  if (error) {
    return <EmptyState title="Não foi possível carregar os templates" message={error.message} />;
  }
  if (loadingStages || loadingTemplates) return <div className={styles.hint}>Carregando…</div>;

  const stageList = stages ?? [];
  const templateList = templates ?? [];
  const stageName = (stageId: string) => stageList.find((s) => s.id === stageId)?.name ?? "—";

  return (
    <div>
      <p className={styles.hint}>
        Mensagem padrão de WhatsApp por estágio + área do prospect. Deixe "área" em branco para
        criar o template coringa desse estágio (usado quando não existe um específico pra área do
        prospect). Placeholders disponíveis: <code>{"{empresa}"}</code> <code>{"{nicho}"}</code>{" "}
        <code>{"{servico_principal}"}</code> <code>{"{cidade}"}</code> <code>{"{bairro}"}</code>
      </p>

      {stageList.length === 0 ? (
        <EmptyState
          title="Nenhum estágio de prospecção cadastrado ainda"
          message='Crie estágios no Pipeline (aba "Ativo") antes de configurar mensagens.'
        />
      ) : (
        <TemplateForm stages={stageList} onSaved={reload} />
      )}

      <div className={styles.list}>
        {templateList.map((template) =>
          editingId === template.id ? (
            <TemplateForm
              key={template.id}
              stages={stageList}
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
                <span className={styles.stageName}>{stageName(template.stageId)}</span>
                {template.niche ? (
                  <Badge label={template.niche} color="#4aa3ff" bg="rgba(74,163,255,.14)" />
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
  stages,
  existing,
  onSaved,
  onCancel,
}: {
  stages: { id: string; name: string }[];
  existing?: MessageTemplate;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { create, update } = useMessageTemplateActions();
  const { toast } = useToast();
  const [stageId, setStageId] = useState(existing?.stageId ?? stages[0]?.id ?? "");
  const [niche, setNiche] = useState(existing?.niche ?? "");
  const [message, setMessage] = useState(existing?.message ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errorNote, setErrorNote] = useState("");

  async function handleSubmit() {
    if (!stageId || !message.trim()) return;
    setSubmitting(true);
    setErrorNote("");
    try {
      if (existing) {
        await update(existing.id, { niche: niche.trim() || null, message: message.trim() });
      } else {
        await create({
          stageId,
          message: message.trim(),
          ...(niche.trim() ? { niche: niche.trim() } : {}),
        });
        setNiche("");
        setMessage("");
      }
      toast(existing ? "Template atualizado" : "Template criado");
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrorNote(err.message);
      } else {
        toast(err instanceof Error ? err.message : "Não foi possível salvar o template");
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
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className={styles.input}
          placeholder="Área (opcional — em branco = coringa do estágio)"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
        />
      </div>
      <textarea
        className={styles.textarea}
        rows={3}
        placeholder="Olá {empresa}, tudo bem? Notei que vocês atuam com {servico_principal}…"
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
          disabled={submitting || !stageId || !message.trim()}
        >
          {submitButtonLabel(submitting, Boolean(existing))}
        </Button>
      </div>
    </div>
  );
}
