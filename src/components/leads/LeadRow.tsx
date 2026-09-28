import type { Lead } from "../../types/lead";
import type { PipelineStage } from "../../types/pipeline";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { originOf } from "../../constants/origins";
import { brl } from "../../utils/currency";
import styles from "./LeadRow.module.css";

/** Linha da lista de leads — etapa pelo id REAL (nome/cor do pipeline do
 * cliente) e o responsável. */
export function LeadRow({
  lead,
  stage,
  ownerName,
  onClick,
}: {
  lead: Lead;
  stage: PipelineStage | undefined;
  ownerName: string | null;
  onClick: () => void;
}) {
  const origin = originOf(lead.origin);

  return (
    <tr
      className={styles.row}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
    >
      <td>
        <div className={styles.name}>
          <Avatar name={lead.name} bg="var(--tone-blue-bg)" color="var(--tone-blue)" size={30} />
          <div>
            <div className={styles.nameText}>{lead.name}</div>
            <div className={styles.company}>{lead.company}</div>
          </div>
        </div>
      </td>
      <td>
        {stage ? (
          <Badge label={stage.label} color={stage.color} bg="var(--tone-gray-bg)" />
        ) : (
          <span className={styles.company}>—</span>
        )}
      </td>
      <td className={styles.company}>{ownerName ?? (lead.ownerId ? "—" : "Sem responsável")}</td>
      <td>
        <span className={styles.origin} style={{ color: origin.color }}>
          {origin.icon} {origin.label}
        </span>
      </td>
      <td className={styles.value}>R$ {brl(lead.value)}</td>
      <td className={styles.prob}>{lead.probability}%</td>
    </tr>
  );
}
