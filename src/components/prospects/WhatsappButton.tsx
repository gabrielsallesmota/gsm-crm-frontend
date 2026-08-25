import type { MouseEvent } from "react";
import type { MessageTemplate, Prospect } from "../../types/prospect";
import { buildWhatsappUrl, findMatchingTemplate, renderMessage } from "../../utils/messageTemplates";
import { useToast } from "../../hooks/useToast";
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
  const { toast } = useToast();
  if (!prospect.phoneNormalized) return null;
  const template = findMatchingTemplate(prospect, templates);
  if (!template) return null;

  const message = renderMessage(template, prospect);
  const url = buildWhatsappUrl(prospect.phoneNormalized, message);
  const btnClass = size === "small" ? `${styles.btn} ${styles.btnSmall}` : styles.btn;

  async function handleCopy(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      // `message` já tem `\n` reais (veio do textarea do template, ver
      // `MessageTemplatesSettings.tsx`) — escrever direto no clipboard evita
      // colar de uma fonte que renderiza parágrafos e perde as quebras
      // (o que acontece ao copiar texto de chat/HTML em vez do valor bruto).
      await navigator.clipboard.writeText(message);
      toast("Mensagem copiada — as quebras de linha vêm junto");
    } catch {
      toast("Não foi possível copiar a mensagem");
    }
  }

  return (
    <span className={styles.group}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={btnClass}
        onClick={(e) => e.stopPropagation()}
        title={message}
      >
        💬 WhatsApp
      </a>
      <button type="button" className={btnClass} onClick={(e) => void handleCopy(e)} title={message}>
        📋 Copiar
      </button>
    </span>
  );
}
