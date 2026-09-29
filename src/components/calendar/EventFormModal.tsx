import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { LeadPicker, type PickedLead } from "../leads/LeadPicker";
import { useCalendarActions } from "../../hooks/useCalendarActions";
import { useToast } from "../../hooks/useToast";
import { browserTimeZone, defaultDueInput, isoToLocalInput, localInputToIso } from "../../utils/datetime";
import type { CalEvent, CalEventType } from "../../types/event";
import form from "../common/Form.module.css";

/** Criar ou editar um compromisso (Etapa 1): lead (busca no servidor),
 * título, tipo e data/hora no fuso do navegador — enviado com fuso. */
export function EventFormModal({
  event,
  fixedLead,
  onClose,
  onSaved,
}: {
  event?: CalEvent;
  fixedLead?: PickedLead;
  onClose: () => void;
  onSaved: (event: CalEvent) => void;
}) {
  const { create, update } = useCalendarActions();
  const { toast, toastError } = useToast();
  const [lead, setLead] = useState<PickedLead | null>(
    fixedLead ?? (event ? { id: event.leadId, name: event.leadName } : null),
  );
  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<CalEventType>(event?.type ?? "reuniao");
  const [at, setAt] = useState(event ? isoToLocalInput(event.at) : defaultDueInput());
  const [saving, setSaving] = useState(false);

  const atIso = localInputToIso(at);
  const valid = !!lead && title.trim().length > 0 && atIso !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !lead || !atIso) return;
    setSaving(true);
    try {
      const saved = event
        ? await update(event.id, { title: title.trim(), type, at: atIso })
        : await create({ leadId: lead.id, title: title.trim(), type, at: atIso });
      toast(event ? "Compromisso atualizado" : "Compromisso criado");
      onSaved(saved);
      onClose();
    } catch (err) {
      toastError(err, event ? "Não foi possível salvar o compromisso." : "Não foi possível criar o compromisso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={event ? "Editar compromisso" : "Novo compromisso"}
      subtitle="Campos com * são obrigatórios."
      onClose={onClose}
    >
      <form className={form.form} onSubmit={(e) => void handleSubmit(e)}>
        <div className={form.field}>
          <span className={form.label}>
            Lead <span aria-hidden="true">*</span>
          </span>
          <LeadPicker value={lead} onChange={setLead} disabled={!!fixedLead || !!event} />
        </div>
        <label className={form.field}>
          <span className={form.label}>
            Título <span aria-hidden="true">*</span>
          </span>
          <input
            className={form.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Ex.: Reunião de apresentação"
            required
            autoFocus
          />
        </label>
        <div className={form.row}>
          <label className={form.field}>
            <span className={form.label}>
              Data e hora <span aria-hidden="true">*</span>
            </span>
            <input
              className={form.input}
              type="datetime-local"
              required
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
            <span className={form.hint}>Horário de {browserTimeZone()}</span>
          </label>
          <label className={form.field}>
            <span className={form.label}>Tipo</span>
            <select
              className={form.select}
              value={type}
              onChange={(e) => setType(e.target.value as CalEventType)}
            >
              <option value="reuniao">Reunião</option>
              <option value="retorno">Retorno</option>
              <option value="visita">Visita</option>
            </select>
          </label>
        </div>
        {at && atIso === null && (
          <div className={form.error} role="alert">
            Data/hora inválida. Escolha o dia e o horário no calendário.
          </div>
        )}
        <div className={form.actions}>
          <Button type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={!valid || saving}>
            {saving ? "Salvando…" : event ? "Salvar" : "Criar compromisso"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
