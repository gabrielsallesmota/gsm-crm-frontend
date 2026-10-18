import type { Lead } from "../../../types/lead";
import type { PipelineStage } from "../../../types/pipeline";
import type { DirectoryMember } from "../../../types/user";
import { ORIGIN, ORIGIN_KEYS } from "../../../constants/origins";
import { brl } from "../../../utils/currency";
import { formatDateTime } from "../../../utils/datetime";
import styles from "../LeadDrawer.module.css";

type Option = { value: string; label: string };

function originLabel(origin: string): string {
  return ORIGIN_KEYS.some((k) => k === origin)
    ? ORIGIN[origin as (typeof ORIGIN_KEYS)[number]].label
    : origin || "—";
}

/**
 * Resumo comercial: etapa e responsável gravam NA HORA (select), o resto é leitura — a edição dos
 * demais dados é o formulário. Em edição, valor/probabilidade/origem saem daqui (estão no formulário).
 */
export function LeadSummary({
  lead,
  stages,
  team,
  canAssign,
  ownerName,
  editing,
  moving,
  assigning,
  onMove,
  onAssign,
}: {
  lead: Lead;
  stages: PipelineStage[];
  team: DirectoryMember[] | null | undefined;
  canAssign: boolean;
  ownerName: string;
  editing: boolean;
  moving: boolean;
  assigning: boolean;
  onMove: (stageId: string) => void;
  onAssign: (ownerId: string) => void;
}) {
  const stage = stages.find((s) => s.id === lead.stageId);
  const stageOptions: Option[] = stages.map((s) => ({
    value: s.id,
    label: `${s.label}${s.isWon ? " (ganho)" : s.isLost ? " (perdido)" : ""}`,
  }));
  return (
    <section className={styles.section} aria-label="Resumo comercial">
      <h3 className={`${styles.sectionTitle} ${styles.sectionTitleSpaced}`}>Resumo comercial</h3>
      <div className={styles.summary}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Etapa</span>
          <select
            className={styles.select}
            value={lead.stageId}
            disabled={moving || stages.length === 0}
            onChange={(e) => onMove(e.target.value)}
          >
            {!stage && <option value={lead.stageId}>—</option>}
            {stageOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Responsável</span>
          {canAssign ? (
            <select
              className={styles.select}
              value={lead.ownerId ?? ""}
              disabled={assigning || !team}
              onChange={(e) => onAssign(e.target.value)}
            >
              {!lead.ownerId && <option value="">Sem responsável</option>}
              {lead.ownerId && !team?.some((m) => m.id === lead.ownerId) && (
                <option value={lead.ownerId}>Usuário inativo</option>
              )}
              {team?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <div className={styles.fieldValue}>{ownerName}</div>
          )}
        </label>
        {!editing && (
          <>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Valor</div>
              <div className={styles.fieldValue}>R$ {brl(lead.value)}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Probabilidade</div>
              <div className={styles.fieldValue}>{lead.probability}%</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Origem</div>
              <div className={styles.fieldValue}>{originLabel(lead.origin)}</div>
            </div>
          </>
        )}
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Criado em</div>
          <div className={styles.fieldValue}>{formatDateTime(lead.createdAt)}</div>
        </div>
      </div>
    </section>
  );
}
