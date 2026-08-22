import type { MessageTemplate, Prospect } from "../../types/prospect";
import { buildWhatsappUrl, findMatchingTemplate, renderMessage } from "../../utils/messageTemplates";
import styles from "./WhatsappButton.module.css";

/**
 * Só renderiza quando existe telefone E um template casando com
 * (estágio, área) do prospect (ver `findMatchingTemplate`) — sem template
 * configurado pra esse estágio, não tem o que mandar, então o botão nem
 * aparece (ver Configurações → Prospecção pra cadastrar um).
 */
export function WhatsappButton({
  prospect,
  templates,
  size = "normal",
}: {
  prospect: Prospect;
  templates: MessageTemplate[];
  size?: "normal" | "small";
}) {
  if (!prospect.phoneNormalized) return null;
  const template = findMatchingTemplate(prospect, templates);
  if (!template) return null;

  const message = renderMessage(template, prospect);
  const url = buildWhatsappUrl(prospect.phoneNormalized, message);

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
