import { useId, useState } from "react";
import type { Lead } from "../../../types/lead";
import type { Tag } from "../../../types/tag";
import { Badge } from "../../common/Badge";
import styles from "../LeadDrawer.module.css";

/** Dados menos usados (notas e tags) sob demanda; abre sozinho quando há conteúdo a mostrar. */
export function MoreDetails({ lead, availableTags }: { lead: Lead; availableTags: Tag[] | null | undefined }) {
  const hasContent = lead.notes.trim().length > 0 || lead.tags.length > 0;
  const [open, setOpen] = useState(hasContent);
  const id = useId();
  return (
    <section className={styles.section} aria-label="Dados complementares">
      <button
        type="button"
        className={styles.disclosureBtn}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Dados complementares</span>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      <div id={id} className={styles.disclosureBody} hidden={!open}>
        {lead.notes && (
          <>
            <h3 className={`${styles.sectionTitle} ${styles.sectionTitleSpaced}`}>Notas</h3>
            <p className={styles.notes}>{lead.notes}</p>
          </>
        )}
        {lead.tags.length > 0 && (
          <>
            <h3 className={`${styles.sectionTitle} ${styles.sectionTitleSpaced}`}>Tags</h3>
            <div className={styles.tagOptions}>
              {lead.tags.map((tagId) => {
                const tag = availableTags?.find((t) => t.id === tagId);
                return tag ? <Badge key={tag.id} label={tag.label} color={tag.color} bg={tag.bg} /> : null;
              })}
            </div>
          </>
        )}
        {!hasContent && <div className={styles.empty}>Sem notas ou tags. Use Editar para adicionar.</div>}
      </div>
    </section>
  );
}
