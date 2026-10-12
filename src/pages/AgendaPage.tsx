import { useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { hasFeature } from "../auth/features";
import { SourceBadge } from "../components/connections/SourceBadge";
import { useCalendar } from "../hooks/useCalendar";
import { useCalendarActions } from "../hooks/useCalendarActions";
import { useToast } from "../hooks/useToast";
import { EmptyState } from "../components/common/EmptyState";
import { SkeletonRows } from "../components/common/Skeleton";
import { usePageTitle } from "../hooks/usePageTitle";
import { Button } from "../components/common/Button";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { EventFormModal } from "../components/calendar/EventFormModal";
import { agendaRange, groupEventsByLocalDay, type AgendaWindow } from "../utils/agenda";
import type { CalEvent } from "../types/event";

type SourceFilter = "" | "crm" | "google" | "microsoft";
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
  const { user } = useAuth();
  const integrations = !!user && hasFeature(user, "calendar_task_integrations");
  const [source, setSource] = useState<SourceFilter>("");
  const filtered = useMemo(() => (source ? { ...range, source } : range), [range, source]);
  const { data, loading, error, reload } = useCalendar(filtered);
  const { delete: deleteEvent } = useCalendarActions();
  const { toast, toastError } = useToast();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [deleting, setDeleting] = useState<CalEvent | null>(null);
  usePageTitle("Agenda");

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
          <p className={styles.pageSubtitle}>
            Compromissos com leads, pessoais e dos calendários conectados (horários no seu fuso)
          </p>
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

      {integrations && (
          <select
            className={styles.select}
            value={source}
            onChange={(e) => {
              setSource(e.target.value as SourceFilter);
              
            }}
            aria-label="Origem"
          >
            <option value="">Todas as origens</option>
            <option value="crm">Somente CRM</option>
            <option value="google">Google</option>
            <option value="microsoft">Microsoft</option>
          </select>
      )}

      {error && (
        <EmptyState
          tone="error"
          title="Não foi possível carregar a agenda"
          message={error.message}
          actions={[{ label: "Tentar de novo", onClick: reload }]}
        />
      )}
      {loading && !data && !error && <SkeletonRows rows={4} label="Carregando a agenda" />}
      {data && days.length === 0 && (
        <EmptyState
          title={
            agendaWindow === "past30"
              ? "Nenhum compromisso nos últimos 30 dias"
              : "Nenhum compromisso agendado"
          }
          message="Registre reuniões, visitas e retornos com seus leads para ver o dia organizado aqui."
          actions={[
            { label: "Novo compromisso", onClick: () => setCreating(true) },
            ...(agendaWindow === "next7"
              ? [{ label: "Ver próximos 30 dias", onClick: () => setAgendaWindow("next30") }]
              : []),
          ]}
        />
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
                  {event.allDay
                    ? "Dia todo"
                    : new Date(event.at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                </span>
                <div className={styles.eventInfo}>
                  <div className={styles.eventTitle}>{event.title}</div>
                  <div className={styles.eventLead}>
                    {event.leadName ?? "Pessoal"}{" "}
                    <SourceBadge source={event.source} url={event.externalUrl} readOnly={event.readOnly} />
                  </div>
                </div>
                <span className={styles.eventType} style={{ color: type?.color }}>
                  {type?.label}
                </span>
                {!event.readOnly && (
                  <>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => setEditing(event)}
                  aria-label={`Editar compromisso: ${event.title}`}
                  title="Editar"
                >
                  ✎
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => setDeleting(event)}
                  aria-label={`Excluir compromisso: ${event.title}`}
                  title="Excluir"
                >
                  ✕
                </button>
                  </>
                )}
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
          message={`"${deleting.title}"${deleting.leadName ? ` com ${deleting.leadName}` : ""} será excluído.`}
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
