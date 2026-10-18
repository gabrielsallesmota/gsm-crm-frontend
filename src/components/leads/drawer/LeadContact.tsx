import type { Lead } from "../../../types/lead";
import styles from "../LeadDrawer.module.css";

/** Como falar com o lead: telefone e e-mail sempre à vista (as ações estão no cabeçalho). */
export function LeadContact({ lead }: { lead: Lead }) {
  return (
    <section className={styles.section} aria-label="Contato">
      <h3 className={`${styles.sectionTitle} ${styles.sectionTitleSpaced}`}>Contato</h3>
      <div className={styles.contact}>
        <div className={styles.contactRow}>
          <span className={styles.contactLabel}>Telefone</span>
          <span className={lead.phone ? styles.contactValue : `${styles.contactValue} ${styles.fieldValueMuted}`}>
            {lead.phone || "—"}
          </span>
        </div>
        <div className={styles.contactRow}>
          <span className={styles.contactLabel}>E-mail</span>
          <span className={lead.email ? styles.contactValue : `${styles.contactValue} ${styles.fieldValueMuted}`}>
            {lead.email || "—"}
          </span>
        </div>
      </div>
    </section>
  );
}
