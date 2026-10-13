import { useEffect, useMemo, useState } from "react";
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
import { EventDetailsModal } from "../components/calendar/EventDetailsModal";
import { MonthGrid, TimeGrid } from "../components/calendar/AgendaGrid";
import { agendaRange, groupEventsByLocalDay, type AgendaWindow } from "../utils/agenda";
import { shiftAnchor, startOfDay, viewRange, viewTitle, type GridView } from "../utils/calendarGrid";
import type { CalEvent, CalendarRange } from "../types/event";
import styles from "./AgendaPage.module.css";

type SourceFilter = "" | "crm" | "google" | "microsoft";
type View = GridView | "list";

const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "Mês" },
  { id: "week", label: "Semana" },
  { id: "day", label: "Dia" },
  { id: "list", label: "Lista" },
];
const VIEW_KEY = "gsm_agenda_view";

function loadView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return VIEWS.some((v) => v.id === saved) ? (saved as View) : "month";
  } catch {
    return "month"; // sem storage (aba privada): usa o padrão
  }
}

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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function AgendaPage() {
  const [view, setViewState] = useState<View>(loadView);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [agendaWindow, setAgendaWindow] = useState<AgendaWindow>("next7");
  const [source, setSource] = useState<SourceFilter>("");
  const [now, setNow] = useState(() => new Date());
  const { user } = useAuth();
  const integrations = !!user && hasFeature(user, "calendar_task_integrations");

  // A linha do "agora" anda sozinha, sem refazer a busca.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function setView(next: View) {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* só não lembra a escolha */
    }
  }

  const grid = view === "list" ? null : viewRange(view, anchor);
  // A janela é calculada UMA vez por escolha (senão o "agora" mudaria e a busca
  // se repetiria sem parar).
  const query: CalendarRange = useMemo(() => {
    const base =
      view === "list"
        ? agendaRange(agendaWindow, new Date())
        : (() => {
            const r = viewRange(view, anchor);
            return { from: r.from.toISOString(), to: r.to.toISOString() };
          })();
    return source ? { ...base, source } : base;
  }, [view, anchor, agendaWindow, source]);

  const { data, loading, error, reload } = useCalendar(query);
  const { delete: deleteEvent } = useCalendarActions();
  const { toast, toastError } = useToast();

  const [creating, setCreating] = useState<{ at?: Date } | null>(null);
  const [opened, setOpened] = useState<CalEvent | null>(null);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [deleting, setDeleting] = useState<CalEvent | null>(null);
  usePageTitle("Agenda");

  async function handleDelete(event: CalEvent): Promise<boolean> {
    try {
      await deleteEvent(event.id);
      toast("Compromisso excluído");
      setOpened(null);
      reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível excluir o compromisso.");
      return false;
    }
  }

  const events = data ?? [];
  const listDays = groupEventsByLocalDay(events);
  const today = startOfDay(now);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Agenda</h1>
          <p className={styles.pageSubtitle}>
            Compromissos com leads, pessoais e dos calendários conectados (horários no seu fuso)
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating({})}>
          + Novo compromisso
        </Button>
      </div>

      <div className={styles.toolbar}>
        {grid && (
          <div className={styles.nav}>
            <button type="button" className={styles.todayBtn} onClick={() => setAnchor(today)}>
              Hoje
            </button>
            <button
              type="button"
              className={styles.arrowBtn}
              aria-label="Período anterior"
              onClick={() => setAnchor(shiftAnchor(view as GridView, anchor, -1))}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.arrowBtn}
              aria-label="Próximo período"
              onClick={() => setAnchor(shiftAnchor(view as GridView, anchor, 1))}
            >
              ›
            </button>
            <h2 className={styles.periodTitle} aria-live="polite">
              {capitalize(viewTitle(view as GridView, anchor))}
            </h2>
          </div>
        )}
        <div className={styles.toolbarRight}>
          {integrations && (
            <select
              className={styles.select}
              value={source}
              onChange={(e) => setSource(e.target.value as SourceFilter)}
              aria-label="Origem"
            >
              <option value="">Todas as origens</option>
              <option value="crm">Somente CRM</option>
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
            </select>
          )}
          <div className={styles.views} role="tablist" aria-label="Visualização da agenda">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                className={view === v.id ? `${styles.viewBtn} ${styles.viewBtnActive}` : styles.viewBtn}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "list" && (
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

      {grid && data && view === "month" && (
        <MonthGrid
          events={events}
          days={grid.days}
          today={today}
          anchorMonth={anchor.getMonth()}
          onOpen={setOpened}
          onPickDay={(day) => {
            setAnchor(day);
            setView("day");
          }}
        />
      )}
      {grid && data && (view === "week" || view === "day") && (
        <TimeGrid
          events={events}
          days={grid.days}
          today={today}
          now={now}
          onOpen={setOpened}
          onPickDay={(day) => {
            setAnchor(day);
            setView("day");
          }}
          onCreateAt={(at) => setCreating({ at })}
        />
      )}
      {grid && data && events.length === 0 && (
        <p className={styles.gridHint}>Nenhum compromisso neste período. Toque em “Novo compromisso” para criar.</p>
      )}

      {view === "list" && data && listDays.length === 0 && (
        <EmptyState
          title={
            agendaWindow === "past30"
              ? "Nenhum compromisso nos últimos 30 dias"
              : "Nenhum compromisso agendado"
          }
          message="Registre reuniões, visitas e retornos com seus leads para ver o dia organizado aqui."
          actions={[
            { label: "Novo compromisso", onClick: () => setCreating({}) },
            ...(agendaWindow === "next7"
              ? [{ label: "Ver próximos 30 dias", onClick: () => setAgendaWindow("next30") }]
              : []),
          ]}
        />
      )}

      {view === "list" &&
        listDays.map((group) => (
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
                      : new Date(event.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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

      {opened && (
        <EventDetailsModal
          event={opened}
          onClose={() => setOpened(null)}
          onEdit={(e) => {
            setOpened(null);
            setEditing(e);
          }}
          onDelete={(e) => {
            setOpened(null);
            setDeleting(e);
          }}
        />
      )}
      {creating && (
        <EventFormModal
          {...(creating.at ? { initialAt: creating.at } : {})}
          onClose={() => setCreating(null)}
          onSaved={() => reload()}
        />
      )}
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
