import { useMemo, useState } from "react";
import { useCalendar } from "../hooks/useCalendar";
import { useCalendarActions } from "../hooks/useCalendarActions";
import { useToast } from "../hooks/useToast";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/common/Button";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { EventFormModal } from "../components/calendar/EventFormModal";
import { agendaRange, groupEventsByLocalDay, type AgendaWindow } from "../utils/agenda";
import type { CalEvent } from "../types/event";
import styles from "./AgendaPage.module.css";

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  reuniao: { label: "Reunião", color: "var(--tone-purple)" },
  retorno: { label: "Retorno", color: "var(--tone-blue)" },
  visita: { label: "Visita", color: "var(--tone-green)" },
};

const WINDOWS: { value: AgendaWindow; label: string }[] = [
  { value: "next7", label: "Próximos 7 dias" },
  { value: "next30", label: "Próximos 30 dias" },
  { value: "past30", label: "Últimos 30 dias" },
];

export function AgendaPage() {
  const [agendaWindow, setAgendaWindow] = useState<AgendaWindow>("next7");
  // A janela é calculada UMA vez por escolha (não a cada render — senão o
  // "agora" mudaria e refaria a busca sem parar).
  const range = useMemo(() => agendaRange(agendaWindow, new Date()), [agendaWindow]);
  const { data, loading, error, reload } = useCalendar(range);
  const { delete: deleteEvent } = useCalendarActions();
  const { toast, toastError } = useToast();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [deleting, setDeleting] = useState<CalEvent | null>(null);

  async function handleDelete(event: CalEvent): Promise<boolean> {
    try {
      await deleteEvent(event.id);
      toast("Compromisso excluído");
      reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível excluir o compromisso.");
      return false;
    }
  }

  const days = groupEventsByLocalDay(data ?? []);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Agenda</h1>
          <p className={styles.pageSubtitle}>Compromissos com leads (horários no seu fuso)</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Novo compromisso
        </Button>
      </div>

      <div className={styles.windows} role="tablist" aria-label="Período">
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            type="button"
            role="tab"
            aria-selected={agendaWindow === w.value}
            className={agendaWindow === w.value ? `${styles.windowBtn} ${styles.windowBtnActive}` : styles.windowBtn}
            onClick={() => setAgendaWindow(w.value)}
          >
            {w.label}
          </button>
        ))}
      </div>

      {error && (
        <EmptyState title="Não foi possível carregar a agenda" message={error.message} />
      )}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && days.length === 0 && (
        <div className={styles.empty}>Nenhum compromisso neste período.</div>
      )}

      {days.map((group) => (
        <div key={group.key} className={styles.dayBlock}>
          <div className={styles.dayHeader}>
            <span className={styles.dayLabel}>{group.label}</span>
            <span className={styles.dayDate}>{group.date}</span>
          </div>
          {group.events.map((event) => {
            const type = TYPE_LABEL[event.type] ?? TYPE_LABEL.reuniao;
            return (
              <div key={event.id} className={styles.eventRow}>
                <span className={styles.eventTime}>
                  {new Date(event.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className={styles.eventInfo}>
                  <div className={styles.eventTitle}>{event.title}</div>
                  <div className={styles.eventLead}>{event.leadName}</div>
                </div>
                <span className={styles.eventType} style={{ color: type?.color }}>
                  {type?.label}
                </span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => setEditing(event)}
                  aria-label="Editar compromisso"
                  title="Editar"
                >
                  ✎
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => setDeleting(event)}
                  aria-label="Excluir compromisso"
                  title="Excluir"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {creating && <EventFormModal onClose={() => setCreating(false)} onSaved={() => reload()} />}
      {editing && (
        <EventFormModal event={editing} onClose={() => setEditing(null)} onSaved={() => reload()} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Excluir compromisso?"
          message={`"${deleting.title}" com ${deleting.leadName} será excluído.`}
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
