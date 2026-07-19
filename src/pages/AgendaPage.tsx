import { useCalendar } from "../hooks/useCalendar";
import { EmptyState } from "../components/common/EmptyState";
import { relativeDayLabel, shortDateLabel } from "../utils/dates";
import type { CalEvent } from "../types/event";
import styles from "./AgendaPage.module.css";

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  reuniao: { label: "Reunião", color: "#a78bfa" },
  retorno: { label: "Retorno", color: "#4aa3ff" },
  visita: { label: "Visita", color: "#2ee66e" },
};

export function AgendaPage() {
  const { data, loading, error, notImplemented } = useCalendar();

  const groups = new Map<string, { label: string; date: string; events: CalEvent[] }>();
  for (const event of data ?? []) {
    const key = event.at.slice(0, 10);
    if (!groups.has(key)) {
      groups.set(key, { label: relativeDayLabel(event.at), date: shortDateLabel(event.at), events: [] });
    }
    groups.get(key)?.events.push(event);
  }
  const days = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <h1 className={styles.pageTitle}>Agenda</h1>
      <p className={styles.pageSubtitle}>Próximos compromissos</p>

      {notImplemented && (
        <EmptyState
          title="Agenda disponível apenas no modo Demo por enquanto"
          message="O backend ainda não tem um módulo de agenda — só autenticação, leads e pipelines. A tela é a mesma; falta só a origem dos dados em produção."
        />
      )}
      {error && !notImplemented && <EmptyState title="Não foi possível carregar a agenda" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && days.length === 0 && !notImplemented && <div className={styles.empty}>Nenhum compromisso agendado.</div>}

      {days.map(([key, group]) => (
        <div key={key} className={styles.dayBlock}>
          <div className={styles.dayHeader}>
            <span className={styles.dayLabel}>{group.label}</span>
            <span className={styles.dayDate}>{group.date}</span>
          </div>
          {group.events.map((event) => {
            const type = TYPE_LABEL[event.type] ?? TYPE_LABEL.reuniao;
            return (
              <div key={event.id} className={styles.eventRow}>
                <span className={styles.eventTime}>{event.time}</span>
                <div className={styles.eventInfo}>
                  <div className={styles.eventTitle}>{event.title}</div>
                  <div className={styles.eventLead}>{event.leadName}</div>
                </div>
                <span className={styles.eventType} style={{ color: type?.color }}>
                  {type?.label}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
