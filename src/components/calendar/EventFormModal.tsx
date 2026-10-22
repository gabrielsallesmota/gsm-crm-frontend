import { useRef, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { LeadPicker, type PickedLead } from "../leads/LeadPicker";
import { PublishTargetSelect } from "../connections/PublishTargetSelect";
import { connectionsService } from "../../services/ConnectionsService";
import { useCalendarActions } from "../../hooks/useCalendarActions";
import { useToast } from "../../hooks/useToast";
import { useTeamDirectory } from "../../hooks/useTeamDirectory";
import { useAuth } from "../../hooks/useAuth";
import { browserTimeZone, defaultDueInput, isoToLocalInput, localInputToIso } from "../../utils/datetime";
import type { CalEvent, CalEventType } from "../../types/event";
import form from "../common/Form.module.css";

/** Criar ou editar um compromisso (Etapa 1): lead (busca no servidor),
 * título, tipo e data/hora no fuso do navegador — enviado com fuso. */
export function EventFormModal({
  event,
  fixedLead,
  initialAt,
  onClose,
  onSaved,
}: {
  event?: CalEvent;
  fixedLead?: PickedLead;
  /** Horário sugerido ao criar (ex.: clique numa hora da grade da agenda). */
  initialAt?: Date;
  onClose: () => void;
  /** `null` quando o item foi criado também no provedor (a tela só recarrega). */
  onSaved: (event: CalEvent | null) => void;
}) {
  const { create, update } = useCalendarActions();
  const { toast, toastError } = useToast();
  const { user } = useAuth();
  const { data: team } = useTeamDirectory();
  const [lead, setLead] = useState<PickedLead | null>(
    fixedLead ?? (event?.leadId ? { id: event.leadId, name: event.leadName ?? "—" } : null),
  );
  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<CalEventType>(event?.type ?? "reuniao");
  const [at, setAt] = useState(
    event ? isoToLocalInput(event.at) : initialAt ? isoToLocalInput(initialAt.toISOString()) : defaultDueInput(),
  );
  // Vazio = fica só comigo; escolher outra pessoa atrela e avisa ela.
  const [assignee, setAssignee] = useState(event?.assigneeUserId ?? "");
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState("");
  // Uma chave por abertura do formulário: reenviar não cria outro evento.
  const publishKey = useRef(crypto.randomUUID());

  const atIso = localInputToIso(at);
  // Sem lead = compromisso pessoal (só você vê).
  const valid = title.trim().length > 0 && atIso !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !atIso) return;
    setSaving(true);
    try {
      let saved: CalEvent | null = null;
      if (event) {
        saved = await update(event.id, {
          title: title.trim(),
          type,
          at: atIso,
          ...(assignee && assignee !== event.assigneeUserId ? { assigneeUserId: assignee } : {}),
        });
      } else if (target) {
        const ends = new Date(new Date(atIso).getTime() + 60 * 60 * 1000).toISOString();
        const published = await connectionsService.publishEvent({
          connectionId: target,
          title: title.trim(),
          startsAt: atIso,
          endsAt: ends,
          ...(lead ? { leadId: lead.id } : {}),
          idempotencyKey: publishKey.current,
        });
        if (published.pushStatus === "failed") {
          toast("Salvo no CRM, mas não foi possível criar no calendário externo. Tente de novo mais tarde.");
          onSaved(null);
          onClose();
          return;
        }
      } else {
        saved = await create({
          ...(lead ? { leadId: lead.id } : {}),
          title: title.trim(),
          type,
          at: atIso,
          ...(assignee ? { assigneeUserId: assignee } : {}),
        });
      }
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
          <span className={form.label}>Lead</span>
          <LeadPicker value={lead} onChange={setLead} disabled={!!fixedLead || !!event} />
          {!lead && !event && (
            <span className={form.hint}>Sem lead, o compromisso é pessoal (só você vê).</span>
          )}
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
        {!event?.readOnly && (
          <label className={form.field}>
            <span className={form.label}>Atrelar a</span>
            <select
              className={form.select}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Só eu</option>
              {team
                ?.filter((m) => m.id !== user?.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
            <span className={form.hint}>A pessoa escolhida recebe um aviso no sino do CRM.</span>
          </label>
        )}
        {!event && <PublishTargetSelect kind="event" value={target} onChange={setTarget} />}
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
