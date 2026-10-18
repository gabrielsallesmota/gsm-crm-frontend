import type { Lead, LeadMessageTemplate } from "../../../types/lead";
import type { PipelineStage } from "../../../types/pipeline";
import { telHref } from "../../../utils/leadForm";
import { Avatar } from "../../common/Avatar";
import { Badge } from "../../common/Badge";
import { EmailButton } from "../EmailButton";
import { WhatsappButton } from "../WhatsappButton";
import styles from "../LeadDrawer.module.css";

/** Cabeçalho fixo: quem é, em que etapa está, quem cuida e como falar com o lead. */
export function DrawerHeader({
  lead,
  stage,
  ownerName,
  templates,
  editing,
  onEdit,
  onClose,
}: {
  lead: Lead;
  stage: PipelineStage | undefined;
  ownerName: string;
  templates: LeadMessageTemplate[];
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const tel = telHref(lead.phone);
  return (
    <div className={styles.top}>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar lead">
        ✕
      </button>
      <div className={styles.header}>
        <Avatar name={lead.name} bg="var(--tone-blue-bg)" color="var(--tone-blue)" size={48} />
        <div className={styles.headerText}>
          <h2 className={styles.name}>{lead.name}</h2>
          {(lead.company || lead.role) && <div className={styles.company}>{lead.company || lead.role}</div>}
          <div className={styles.chips}>
            {stage && (
              <Badge
                label={stage.isWon ? `🏆 ${stage.label}` : stage.label}
                color={stage.color}
                bg="var(--tone-gray-bg)"
              />
            )}
            <span className={styles.ownerChip}>
              <Avatar name={ownerName} bg="var(--tone-gray-bg)" color="var(--tone-gray)" size={20} />
              {ownerName}
            </span>
          </div>
        </div>
      </div>
      <div className={styles.quickActions} role="group" aria-label="Ações rápidas">
        <WhatsappButton lead={lead} templates={templates} />
        {tel && (
          <a className={styles.actionBtn} href={tel}>
            📞 Ligar
          </a>
        )}
        <EmailButton lead={lead} />
        {!editing && (
          <button type="button" className={`${styles.actionBtn} ${styles.actionSpacer}`} onClick={onEdit}>
            ✎ Editar
          </button>
        )}
      </div>
    </div>
  );
}
