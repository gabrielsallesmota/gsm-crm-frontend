import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { SkeletonRows } from "../common/Skeleton";
import { EmptyState } from "../common/EmptyState";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { connectionsService } from "../../services/ConnectionsService";
import { describeError } from "../../utils/apiErrors";
import type { Connection } from "../../types/connections";
import form from "../common/Form.module.css";
import styles from "./Connections.module.css";

interface Choices {
  calendars: { id: string; name: string; primary: boolean; selected: boolean }[];
  lists: { id: string; name: string; selected: boolean }[];
}

/**
 * Escolha de quais calendários/listas do provedor entram na sincronização.
 * O CRM só lê e grava o que for marcado aqui — o restante da conta nunca é
 * tocado. Os nomes vêm do provedor na hora (nada é guardado antes).
 */
export function SelectionModal({
  connection,
  onClose,
  onSaved,
}: {
  connection: Connection;
  onClose: () => void;
  onSaved: (updated: Connection) => void;
}) {
  const state = useAsyncResource<Choices>(async () => {
    const [calendars, lists] = await Promise.all([
      connection.calendarEnabled ? connectionsService.calendars(connection.id) : [],
      connection.tasksEnabled ? connectionsService.taskLists(connection.id) : [],
    ]);
    return { calendars, lists };
  }, [connection.id]);
  const [calendarIds, setCalendarIds] = useState<string[] | null>(null);
  const [listIds, setListIds] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = state.data;
  const chosenCalendars =
    calendarIds ?? data?.calendars.filter((c) => c.selected).map((c) => c.id) ?? [];
  const chosenLists = listIds ?? data?.lists.filter((l) => l.selected).map((l) => l.id) ?? [];

  function toggle(current: string[], id: string): string[] {
    return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await connectionsService.update(connection.id, {
        ...(connection.calendarEnabled ? { calendarIds: chosenCalendars } : {}),
        ...(connection.tasksEnabled ? { taskListIds: chosenLists } : {}),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(describeError(err, "Não foi possível salvar a seleção."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Escolher calendários e listas"
      subtitle="Só o que você marcar será sincronizado."
      onClose={onClose}
    >
      {state.error && !data && (
        <EmptyState
          tone="error"
          title="Não foi possível listar"
          message={describeError(state.error, "Tente novamente em instantes.")}
          actions={[{ label: "Tentar de novo", onClick: state.reload }]}
        />
      )}
      {state.loading && !data && !state.error && (
        <SkeletonRows rows={4} label="Buscando no provedor" />
      )}
      {data && (
        <div className={form.form}>
          {connection.calendarEnabled && (
            <fieldset className={styles.toggles}>
              <legend>Calendários</legend>
              {data.calendars.length === 0 && <p className={styles.muted}>Nenhum calendário encontrado.</p>}
              {data.calendars.map((c) => (
                <label key={c.id} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={chosenCalendars.includes(c.id)}
                    onChange={() => setCalendarIds(toggle(chosenCalendars, c.id))}
                  />
                  {c.name}
                  {c.primary ? " (principal)" : ""}
                </label>
              ))}
            </fieldset>
          )}
          {connection.tasksEnabled && (
            <fieldset className={styles.toggles}>
              <legend>Listas de tarefas</legend>
              {data.lists.length === 0 && <p className={styles.muted}>Nenhuma lista encontrada.</p>}
              {data.lists.map((l) => (
                <label key={l.id} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={chosenLists.includes(l.id)}
                    onChange={() => setListIds(toggle(chosenLists, l.id))}
                  />
                  {l.name}
                </label>
              ))}
            </fieldset>
          )}
          {!connection.calendarEnabled && !connection.tasksEnabled && (
            <p className={styles.muted}>Ative Agenda e/ou Tarefas para escolher o que sincronizar.</p>
          )}
          {error && (
            <div className={form.error} role="alert">
              {error}
            </div>
          )}
          <div className={form.actions}>
            <Button type="button" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar seleção"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
