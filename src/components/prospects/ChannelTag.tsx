import type { MouseEvent } from "react";
import type { MessageTemplate, Prospect, ProspectStage } from "../../types/prospect";
import { resolveProspectMessage } from "../../utils/messageTemplates";
import { useToast } from "../../hooks/useToast";
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
 * - instagram → tag rosa; clicar copia a mensagem resolvida pro estágio
 *   atual (mesma lógica usada no "Copiar" do WhatsApp) — não dá pra abrir
 *   um DM do Instagram de forma confiável entre plataformas.
 * - email → tag branca; clicar copia destinatário + assunto + corpo,
 *   pronto pra colar no cliente de e-mail.
 */
export function ChannelTag({
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
  const channel = prospect.contactChannel || "whatsapp";

  if (channel === "whatsapp") {
    return <WhatsappButton prospect={prospect} stage={stage} templates={templates} size={size} />;
  }

  const message = resolveProspectMessage(prospect, stage, templates);
  const meta = CONTACT_CHANNEL[channel];
  const disabled = channel === "instagram" ? !message : !prospect.email;
  const btnClass = [styles.btn, size === "small" ? styles.btnSmall : "", disabled ? styles.btnDisabled : ""]
    .filter(Boolean)
    .join(" ");
  const style = { color: meta.color, background: meta.bg, borderColor: `${meta.color}40` };

  async function handleClick(e: MouseEvent) {
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

  return (
    <button
      type="button"
      className={btnClass}
      style={style}
      onClick={(e) => void handleClick(e)}
      title={channel === "instagram" ? message : buildEmailText(prospect, message)}
    >
      {meta.label}
    </button>
  );
}
