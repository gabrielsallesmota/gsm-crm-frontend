import type { Lead } from "../../types/lead";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { STAGES } from "../../constants/stages";
import { TEMP } from "../../constants/temperature";
import { brl } from "../../utils/currency";
import styles from "./LeadDrawer.module.css";

export function LeadDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const stage = STAGES[lead.stage];
  const temp = TEMP[lead.temperature];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Fechar">
          ✕
        </button>

        <div className={styles.header}>
          <Avatar name={lead.name} bg="rgba(74,163,255,.14)" color="#4aa3ff" size={48} />
          <div>
            <div className={styles.name}>{lead.name}</div>
            <div className={styles.company}>{lead.company !== "—" ? lead.company : lead.role}</div>
          </div>
        </div>

        <div className={styles.badges}>
          <Badge label={stage.label} color={stage.color} bg={stage.bg} />
          <Badge label={temp.label} color={temp.color} bg="rgba(255,255,255,.06)" />
        </div>

        <div className={styles.grid}>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Valor</div>
            <div className={styles.fieldValue}>R$ {brl(lead.value)}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Probabilidade</div>
            <div className={styles.fieldValue}>{lead.probability}%</div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Telefone</div>
            <div className={styles.fieldValue}>{lead.phone || "—"}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>E-mail</div>
            <div className={styles.fieldValue}>{lead.email || "—"}</div>
          </div>
        </div>

        {lead.notes && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Notas</div>
            <p className={styles.notes}>{lead.notes}</p>
          </div>
        )}

        {(lead.aiSummary || lead.aiNext) && (
          <div className={styles.aiBox}>
            {lead.aiSummary && <p className={styles.aiSummary}>{lead.aiSummary}</p>}
            {lead.aiNext && (
              <p className={styles.aiNext}>
                <strong>Próximo passo:</strong> {lead.aiNext}
              </p>
            )}
          </div>
        )}

        {lead.tasks.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Tarefas</div>
            {lead.tasks.map((t) => (
              <div key={t.id} className={styles.taskRow}>
                <span>{t.done ? "☑" : "☐"}</span>
                <span className={t.done ? styles.taskDone : undefined}>{t.title}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Linha do tempo</div>
          {lead.timeline.length === 0 && <div className={styles.empty}>Sem atividades registradas ainda.</div>}
          {lead.timeline.map((t, i) => (
            <div key={i} className={styles.timelineRow}>
              <span className={styles.timelineIcon} style={{ color: t.color }}>
                {t.icon}
              </span>
              <div>
                <div className={styles.timelineTitle}>{t.title}</div>
                <div className={styles.timelineDesc}>{t.desc}</div>
                <div className={styles.timelineWho}>{t.who}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
