import type { Lead, LeadMessageTemplate } from "../../types/lead";
import { buildWhatsappUrl, findMatchingLeadTemplate, renderLeadMessage } from "../../utils/leadMessageTemplates";
import styles from "../prospects/WhatsappButton.module.css";

/**
 * Só renderiza quando existe telefone E um template casando com
 * (estágio, origem) do lead (ver `findMatchingLeadTemplate`) — sem template
 * configurado pra esse estágio, não tem o que mandar, então o botão nem
 * aparece (ver Configurações → Pipeline pra cadastrar um). Reaproveita o
 * CSS do botão equivalente de `prospects` — visual idêntico, mesmo motivo
 * de existir dois componentes (módulos de dados separados).
 */
export function WhatsappButton({
  lead,
  templates,
  size = "normal",
}: {
  lead: Lead;
  templates: LeadMessageTemplate[];
  size?: "normal" | "small";
}) {
  if (!lead.phoneNormalized) return null;
  const template = findMatchingLeadTemplate(lead, templates);
  if (!template) return null;

  const message = renderLeadMessage(template, lead);
  const url = buildWhatsappUrl(lead.phoneNormalized, message);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={size === "small" ? `${styles.btn} ${styles.btnSmall}` : styles.btn}
      onClick={(e) => e.stopPropagation()}
      title={message}
    >
      💬 WhatsApp
    </a>
  );
}
