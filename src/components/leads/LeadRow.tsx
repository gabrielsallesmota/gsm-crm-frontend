import type { Lead } from "../../types/lead";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { STAGES } from "../../constants/stages";
import { originOf } from "../../constants/origins";
import { brl } from "../../utils/currency";
import styles from "./LeadRow.module.css";

export function LeadRow({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const stage = STAGES[lead.stage];
  const origin = originOf(lead.origin);

  return (
    <tr className={styles.row} onClick={onClick}>
      <td>
        <div className={styles.name}>
          <Avatar name={lead.name} bg="rgba(74,163,255,.14)" color="#4aa3ff" size={30} />
          <div>
            <div className={styles.nameText}>{lead.name}</div>
            <div className={styles.company}>{lead.company}</div>
          </div>
        </div>
      </td>
      <td>
        <Badge label={stage.label} color={stage.color} bg={stage.bg} />
      </td>
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
