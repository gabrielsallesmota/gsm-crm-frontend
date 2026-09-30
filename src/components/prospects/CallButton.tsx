import type { MouseEvent } from "react";
import type { MessageTemplate, Prospect, ProspectStage } from "../../types/prospect";
import { resolveProspectMessage } from "../../utils/messageTemplates";
import { useToast } from "../../hooks/useToast";
import styles from "./WhatsappButton.module.css";

/**
 * Ação do card em estágio de LIGAÇÃO (`stage.contactMethod === "ligacao"`):
 * "Ligar" abre o discador (`tel:`) e "Roteiro" copia o texto do campo de
 * mensagem do estágio — ali fica o roteiro da ligação (gerado sem IA ou
 * importado da IA). Sem telefone, só o roteiro.
 */
export function CallButton({
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
  const script = resolveProspectMessage(prospect, stage, templates);
  const phone = prospect.phoneNormalized;
  const btnClass = size === "small" ? `${styles.btn} ${styles.btnSmall}` : styles.btn;

  async function handleCopyScript(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!script) {
      toast("Sem roteiro para este estágio — gere ou importe as mensagens no prospect", "warning");
      return;
    }
    try {
      await navigator.clipboard.writeText(script);
      toast("Roteiro copiado");
    } catch {
      toast("Não foi possível copiar o roteiro", "error");
    }
  }

  return (
    <span className={styles.group}>
      {phone && (
        <a
          href={`tel:+${phone}`}
          className={btnClass}
          onClick={(e) => e.stopPropagation()}
          title={script ?? "Ligar"}
        >
          📞 Ligar
        </a>
      )}
      <button
        type="button"
        className={btnClass}
        onClick={(e) => void handleCopyScript(e)}
        title={script ?? "Sem roteiro"}
      >
        📝 Roteiro
      </button>
    </span>
  );
}
