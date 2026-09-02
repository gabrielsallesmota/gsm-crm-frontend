import type { MouseEvent } from "react";
import type { MessageTemplate, Prospect, ProspectStage } from "../../types/prospect";
import { buildWhatsappUrl, resolveProspectMessage } from "../../utils/messageTemplates";
import { useToast } from "../../hooks/useToast";
import styles from "./WhatsappButton.module.css";

/**
 * Só renderiza quando alguma mensagem resolve pro (prospect, estágio) atual
 * (ver `resolveProspectMessage` — mensagem própria do prospect configurada
 * no estágio, ou o template padrão por área). Sem isso, não tem o que
 * mandar, então o botão nem aparece (ver Configurações → Prospecção pra
 * cadastrar um template, ou "Estágios" pra apontar um campo de mensagem).
 *
 * O link "abrir WhatsApp" exige telefone E `!prospect.noWhatsapp` — um lead
 * marcado como "sem WhatsApp" (contato só por e-mail) nunca tem esse link,
 * mas "Copiar" continua disponível (com ou sem telefone) pra colar a
 * mensagem num e-mail.
 */
export function WhatsappButton({
  prospect,
  stage,
  templates,
  size = "normal",
}: {
  prospect: Prospect;
  stage: ProspectStage | undefined;
  templates: MessageTemplate[];
  size?: "normal" | "small";
}) {
  const { toast } = useToast();
  const resolved = resolveProspectMessage(prospect, stage, templates);
  if (!resolved) return null;
  // `const` sozinho não basta pro TS propagar o narrowing de `resolved`
  // pra dentro de `handleCopy` (function declaration aninhada) — reatribui
  // pra um `string` de verdade, sem `| undefined`.
  const message: string = resolved;

  const canOpenWhatsapp = !prospect.noWhatsapp && !!prospect.phoneNormalized;
  const url = canOpenWhatsapp ? buildWhatsappUrl(prospect.phoneNormalized, message) : null;
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
      {url && (
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
      )}
      <button type="button" className={btnClass} onClick={(e) => void handleCopy(e)} title={message}>
        📋 Copiar
      </button>
    </span>
  );
}
