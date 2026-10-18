import type { Lead, LeadMessageTemplate } from "../../types/lead";
import {
  buildWhatsappUrl,
  findMatchingLeadTemplate,
  renderLeadMessage,
} from "../../utils/leadMessageTemplates";
import { IconWhatsapp } from "../common/Icons";
import styles from "../prospects/WhatsappButton.module.css";

/**
 * Renderiza quando existe telefone. Com template casando com (estágio, origem)
 * (ver `findMatchingLeadTemplate`) abre com a mensagem pronta; sem template abre a
 * conversa em branco (Configurações → Pipeline cadastra templates). Reaproveita o
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
  /** `icon`: só o ícone (cartões compactos); o nome acessível vai em `aria-label`. */
  size?: "normal" | "small" | "icon";
}) {
  if (!lead.phoneNormalized) return null;
  const template = findMatchingLeadTemplate(lead, templates);
  // Sem template o botão continua: abre a conversa em branco. O CRM não confere se o número
  // tem WhatsApp — quem clica descobre ao abrir.
  const message = template ? renderLeadMessage(template, lead) : "";
  const url = message
    ? buildWhatsappUrl(lead.phoneNormalized, message)
    : `https://wa.me/${lead.phoneNormalized}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={
        size === "icon"
          ? `${styles.btn} ${styles.btnIcon}`
          : size === "small"
            ? `${styles.btn} ${styles.btnSmall}`
            : styles.btn
      }
      onClick={(e) => e.stopPropagation()}
      title={message || "Abrir conversa no WhatsApp"}
      {...(size === "icon" ? { "aria-label": `Abrir WhatsApp de ${lead.name}` } : {})}
    >
      {size === "icon" ? <IconWhatsapp size={16} /> : "💬 WhatsApp"}
    </a>
  );
}
