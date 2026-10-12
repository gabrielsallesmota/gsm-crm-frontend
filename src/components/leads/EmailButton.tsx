import type { Lead } from "../../types/lead";
import { buildMailtoUrl } from "../../utils/connections";
import styles from "./EmailButton.module.css";

/**
 * Abre o programa de e-mail DO USUÁRIO com o destinatário preenchido
 * (`mailto:`). O CRM não envia nada e não registra e-mail como “enviado”:
 * quem envia é a própria pessoa, no cliente de e-mail dela. Só aparece
 * quando o lead tem um e-mail válido. Fica ao lado do botão de WhatsApp.
 */
export function EmailButton({ lead, size = "normal" }: { lead: Lead; size?: "normal" | "small" }) {
  const subject = lead.company ? `${lead.company} — ${lead.name}` : lead.name;
  const url = buildMailtoUrl(lead.email, { subject });
  if (!url) return null;
  return (
    <a
      href={url}
      className={size === "small" ? `${styles.btn} ${styles.btnSmall}` : styles.btn}
      onClick={(e) => e.stopPropagation()}
      title="Abre seu programa de e-mail (nada é enviado pelo CRM)"
      aria-label={`Escrever e-mail para ${lead.name}`}
    >
      ✉ E-mail
    </a>
  );
}
