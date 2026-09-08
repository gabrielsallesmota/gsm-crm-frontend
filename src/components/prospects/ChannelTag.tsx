import { useState, type MouseEvent } from "react";
import type { MessageTemplate, Prospect, ProspectStage } from "../../types/prospect";
import { buildInstagramUrl, resolveProspectMessage } from "../../utils/messageTemplates";
import { useToast } from "../../hooks/useToast";
import { useProspectActions } from "../../hooks/useProspectActions";
import { CONTACT_CHANNEL } from "../../constants/prospectEnums";
import { WhatsappButton } from "./WhatsappButton";
import styles from "./ChannelTag.module.css";

/** `Para: .../Assunto: ...` só entra se tiver dado — um prospect com canal
 * "email" mas sem `email`/`emailSubject` preenchido ainda copia só o corpo. */
function buildEmailText(prospect: Prospect, message: string | undefined): string {
  const header: string[] = [];
  if (prospect.email) header.push(`Para: ${prospect.email}`);
  if (prospect.emailSubject) header.push(`Assunto: ${prospect.emailSubject}`);
  const body = message ?? "";
  return header.length > 0 ? `${header.join("\n")}\n\n${body}` : body;
}

/**
 * Ação de contato do card, de acordo com `prospect.contactChannel` (ver
 * `ContactChannel`):
 * - whatsapp (ou prospect antigo sem o campo) → `WhatsappButton` de sempre,
 *   sem mudança nenhuma de comportamento — link `wa.me` com direcionamento.
 * - instagram → tag rosa; link "Abrir Instagram" pro perfil (`prospect.
 *   instagram`, ver `buildInstagramUrl`) quando tiver esse campo
 *   preenchido, mais um botão "Copiar" que copia a mensagem resolvida pro
 *   estágio atual — não dá pra abrir um DM já com o texto preenchido de
 *   forma confiável entre plataformas (diferente do WhatsApp), então a
 *   pessoa cola a mensagem depois de abrir o perfil.
 * - email → tag branca; "Enviar" manda de verdade (Resend, via backend) a
 *   mesma mensagem do estágio atual, com `prospect.emailSubject` como
 *   assunto — chama `onSent` só quando o envio deu certo, pra quem estiver
 *   usando isto (`ProspectionBoard`/`ProspectDrawer`) decidir se avança o
 *   prospect pro próximo estágio. "Copiar" continua do lado, pra quem
 *   prefere mandar pelo próprio cliente de e-mail.
 */
export function ChannelTag({
  prospect,
  stage,
  templates,
  size = "normal",
  onSent,
}: {
  prospect: Prospect;
  stage: ProspectStage | undefined;
  templates: MessageTemplate[];
  size?: "normal" | "small";
  /** Chamado só depois de um envio de e-mail bem-sucedido (canal email,
   * botão "Enviar") — nunca depois de "Copiar". */
  onSent?: () => void;
}) {
  const { toast } = useToast();
  const { sendEmail } = useProspectActions();
  const [sending, setSending] = useState(false);
  const channel = prospect.contactChannel || "whatsapp";

  if (channel === "whatsapp") {
    return <WhatsappButton prospect={prospect} stage={stage} templates={templates} size={size} />;
  }

  const message = resolveProspectMessage(prospect, stage, templates);
  const meta = CONTACT_CHANNEL[channel];
  const style = { color: meta.color, background: meta.bg, borderColor: `${meta.color}40` };

  async function handleCopy(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (channel === "instagram") {
      if (!message) {
        toast("Sem mensagem configurada pra esse estágio");
        return;
      }
      try {
        await navigator.clipboard.writeText(message);
        toast("Mensagem copiada — as quebras de linha vêm junto");
      } catch {
        toast("Não foi possível copiar a mensagem");
      }
      return;
    }
    // email
    if (!prospect.email) {
      toast("Sem e-mail cadastrado");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildEmailText(prospect, message));
      toast("E-mail copiado — cole no seu cliente de e-mail");
    } catch {
      toast("Não foi possível copiar o e-mail");
    }
  }

  if (channel === "instagram") {
    const url = buildInstagramUrl(prospect.instagram);
    const btnClass = [styles.btn, size === "small" ? styles.btnSmall : ""].filter(Boolean).join(" ");
    const copyDisabled = !message;
    return (
      <span className={styles.group}>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={btnClass}
            style={style}
            onClick={(e) => e.stopPropagation()}
            title={`Abrir ${url}`}
          >
            {meta.label}
          </a>
        )}
        <button
          type="button"
          className={`${btnClass} ${copyDisabled ? styles.btnDisabled : ""}`}
          style={style}
          onClick={(e) => void handleCopy(e)}
          title={message}
        >
          Copiar
        </button>
      </span>
    );
  }

  // email
  async function handleSend(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!prospect.email) {
      toast("Sem e-mail cadastrado");
      return;
    }
    if (!message) {
      toast("Sem mensagem configurada pra esse estágio");
      return;
    }
    setSending(true);
    try {
      const { sent } = await sendEmail(
        prospect.id,
        prospect.emailSubject || "Contato GSM Automação",
        message,
      );
      if (sent) {
        toast("E-mail enviado");
        onSent?.();
      } else {
        toast("Não foi possível enviar o e-mail agora — tente de novo em instantes");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível enviar o e-mail");
    } finally {
      setSending(false);
    }
  }

  const btnClass = [styles.btn, size === "small" ? styles.btnSmall : ""].filter(Boolean).join(" ");
  const sendDisabled = !prospect.email || !message || sending;
  const copyDisabled = !prospect.email;

  return (
    <span className={styles.group}>
      <button
        type="button"
        className={`${btnClass} ${sendDisabled ? styles.btnDisabled : ""}`}
        style={style}
        onClick={(e) => void handleSend(e)}
        title={buildEmailText(prospect, message)}
      >
        {sending ? "Enviando…" : "Enviar"}
      </button>
      <button
        type="button"
        className={`${btnClass} ${copyDisabled ? styles.btnDisabled : ""}`}
        style={style}
        onClick={(e) => void handleCopy(e)}
        title={buildEmailText(prospect, message)}
      >
        Copiar
      </button>
    </span>
  );
}
