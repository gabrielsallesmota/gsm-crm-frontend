import { useState } from "react";
import { useCalendar } from "../hooks/useCalendar";
import { useCalendarActions } from "../hooks/useCalendarActions";
import { useLeads } from "../hooks/useLeads";
import { useToast } from "../hooks/useToast";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/common/Button";
import { relativeDayLabel, shortDateLabel } from "../utils/dates";
import type { CalEvent, CalEventType } from "../types/event";
import styles from "./AgendaPage.module.css";

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  reuniao: { label: "Reunião", color: "#a78bfa" },
  retorno: { label: "Retorno", color: "#4aa3ff" },
  visita: { label: "Visita", color: "#2ee66e" },
};

export function AgendaPage() {
  // Sem branch de `notImplemented` de propósito — mesma razão de
  // `DashboardPage.tsx`: `CalendarApiRepository` já chama `GET
  // /api/v1/calendar/events` de verdade e nunca lança `NotImplementedError`.
  const { data, loading, error, reload } = useCalendar();
  const { data: leadsPage } = useLeads({ pageSize: 200 });
  const { create, delete: deleteEvent } = useCalendarActions();
  const { toast } = useToast();

  const [leadId, setLeadId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CalEventType>("reuniao");
  const [at, setAt] = useState("");

  async function handleCreate() {
    if (!leadId || !title.trim() || !at) return;
    await create({ leadId, title: title.trim(), type, at: new Date(at).toISOString() });
    setTitle("");
    setAt("");
    toast("Compromisso criado");
    reload();
  }

  async function handleDelete(eventId: string) {
    await deleteEvent(eventId);
    toast("Compromisso removido");
    reload();
  }

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

      <div className={styles.inlineForm}>
        <select className={styles.select} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
          <option value="">Lead…</option>
          {leadsPage?.items.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.name}
            </option>
          ))}
        </select>
        <input
          className={styles.input}
          placeholder="Título do compromisso…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select className={styles.select} value={type} onChange={(e) => setType(e.target.value as CalEventType)}>
          <option value="reuniao">Reunião</option>
          <option value="retorno">Retorno</option>
          <option value="visita">Visita</option>
        </select>
        <input
          className={styles.input}
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
        />
        <Button variant="primary" onClick={() => void handleCreate()} disabled={!leadId || !title.trim() || !at}>
          Adicionar
        </Button>
      </div>

      {error && <EmptyState title="Não foi possível carregar a agenda" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && days.length === 0 && <div className={styles.empty}>Nenhum compromisso agendado.</div>}

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
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => void handleDelete(event.id)}
                  aria-label="Remover compromisso"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
