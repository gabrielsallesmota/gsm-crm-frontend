import { useState } from "react";
import { useTags } from "../../hooks/useTags";
import { useTagActions } from "../../hooks/useTagActions";
import { useToast } from "../../hooks/useToast";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { EmptyState } from "../common/EmptyState";
import { hexToRgba } from "../../utils/colors";
import type { Tag } from "../../types/tag";
import { SettingsCard } from "./SettingsCard";
import styles from "./Settings.module.css";

/** Tags dos leads: criar e remover (a remoção só tira a etiqueta; nenhum lead é excluído). */
export function TagsSection() {
  const { data: tags, error: tagsError, reload: reloadTags } = useTags();
  const { create: createTag, delete: deleteTag } = useTagActions();
  const { toast, toastError } = useToast();
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState("#4aa3ff");
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<Tag | null>(null);

  async function handleCreateTag() {
    if (!newTagLabel.trim()) return;
    try {
      await createTag({ label: newTagLabel.trim(), color: newTagColor, bg: hexToRgba(newTagColor, 0.14) });
      setNewTagLabel("");
      toast("Tag criada");
      reloadTags();
    } catch (err) {
      toastError(err, "Não foi possível criar a tag");
    }
  }

  async function handleDeleteTag(tag: Tag): Promise<boolean> {
    try {
      await deleteTag(tag.id);
      toast("Tag removida");
      reloadTags();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível remover a tag");
      return false;
    }
  }

  return (
    <SettingsCard
      title="Tags"
      description="Etiquetas para classificar leads (ex.: VIP, indicação). Aparecem no cadastro e na edição do lead."
      actions={
        <div className={styles.inlineForm}>
          <input
            className={styles.input}
            placeholder="Nome da nova tag…"
            aria-label="Nome da nova tag"
            value={newTagLabel}
            onChange={(e) => setNewTagLabel(e.target.value)}
          />
          <input
            className={styles.colorInput}
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            aria-label="Cor da tag"
          />
          <Button variant="primary" onClick={() => void handleCreateTag()} disabled={!newTagLabel.trim()}>
            Adicionar
          </Button>
        </div>
      }
    >
      {tagsError && (
        <EmptyState
          tone="error"
          title="Não foi possível carregar as tags"
          message={tagsError.message}
          actions={[{ label: "Tentar de novo", onClick: reloadTags }]}
        />
      )}
      {tags && tags.length === 0 && (
        <p className={styles.help}>Nenhuma tag criada ainda. Use o campo acima para criar a primeira.</p>
      )}
      <div className={styles.chipRow}>
        {tags?.map((tag) => (
          <span key={tag.id} className={styles.tagChip}>
            <Badge label={tag.label} color={tag.color} bg={tag.bg} />
            <button
              type="button"
              className={styles.tagDeleteBtn}
              onClick={() => setConfirmDeleteTag(tag)}
              aria-label={`Remover tag ${tag.label}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      {confirmDeleteTag && (
        <ConfirmDialog
          title="Remover tag?"
          message={`A tag "${confirmDeleteTag.label}" será removida e deixará de aparecer nos leads que a usam. Os leads não são excluídos.`}
          confirmLabel="Remover"
          onConfirm={() => handleDeleteTag(confirmDeleteTag)}
          onClose={() => setConfirmDeleteTag(null)}
        />
      )}
    </SettingsCard>
  );
}
