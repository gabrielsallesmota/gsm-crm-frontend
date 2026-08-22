import {
  EMPTY_PERIOD,
  last7DaysPeriod,
  lastMonthPeriod,
  thisMonthPeriod,
  todayPeriod,
  type Period,
} from "../../utils/periods";
import styles from "./PeriodFilter.module.css";

type PresetKey = "todos" | "hoje" | "7dias" | "mes" | "mesPassado" | "custom";

const PRESETS: { key: PresetKey; label: string; period: Period }[] = [
  { key: "todos", label: "Tudo", period: EMPTY_PERIOD },
  { key: "hoje", label: "Hoje", period: todayPeriod() },
  { key: "7dias", label: "7 dias", period: last7DaysPeriod() },
  { key: "mes", label: "Este mês", period: thisMonthPeriod() },
  { key: "mesPassado", label: "Mês passado", period: lastMonthPeriod() },
];

/** `exactOptionalPropertyTypes` não deixa atribuir `undefined` direto numa
 * prop opcional — remove a chave do objeto em vez disso quando o campo é
 * limpo. */
function withField(value: Period, key: "dateFrom" | "dateTo", raw: string): Period {
  const next = { ...value };
  if (raw) next[key] = raw;
  else delete next[key];
  return next;
}

function activePreset(value: Period): PresetKey {
  const match = PRESETS.find(
    (p) => p.period.dateFrom === value.dateFrom && p.period.dateTo === value.dateTo,
  );
  if (match) return match.key;
  return value.dateFrom || value.dateTo ? "custom" : "todos";
}

/** Filtro de período compartilhado por Pipeline e Dashboard — presets rápidos
 * + intervalo customizado. Controlado: quem usa guarda o `Period` no estado
 * e passa pros hooks de leitura (`useLeads`/`useProspects`/`useDashboard`/
 * `useProspectDashboard`). */
export function PeriodFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const current = activePreset(value);

  return (
    <div className={styles.wrap}>
      <div className={styles.presetGroup}>
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={
              current === preset.key ? `${styles.presetBtn} ${styles.presetBtnActive}` : styles.presetBtn
            }
            onClick={() => onChange(preset.period)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className={styles.customRow}>
        <input
          type="date"
          className={styles.dateInput}
          value={value.dateFrom ?? ""}
          onChange={(e) => onChange(withField(value, "dateFrom", e.target.value))}
        />
        <span className={styles.dateSeparator}>até</span>
        <input
          type="date"
          className={styles.dateInput}
          value={value.dateTo ?? ""}
          onChange={(e) => onChange(withField(value, "dateTo", e.target.value))}
        />
      </div>

      {(value.dateFrom || value.dateTo) && (
        <button type="button" className={styles.clearBtn} onClick={() => onChange(EMPTY_PERIOD)}>
          Limpar
        </button>
      )}
    </div>
  );
}
