import { useRef, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { LeadPicker, type PickedLead } from "../leads/LeadPicker";
import { PublishTargetSelect } from "../connections/PublishTargetSelect";
import { connectionsService } from "../../services/ConnectionsService";
import { useTaskActions } from "../../hooks/useTaskActions";
import { useTeamDirectory } from "../../hooks/useTeamDirectory";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { browserTimeZone, defaultDueInput, isoToLocalInput, localInputToIso } from "../../utils/datetime";
import type { Task, TaskPriority } from "../../types/task";
import form from "../common/Form.module.css";

/**
 * Criar OU editar/reagendar uma tarefa (Etapa 1): lead (busca no servidor
 * ou fixo quando aberto a partir do lead), título, prioridade, vencimento
 * com data+hora no fuso do navegador (enviado em UTC com fuso — o backend
 * recusa horário sem fuso) e responsável (membros ativos da equipe).
 */
export function TaskFormModal({
  task,
  fixedLead,
  onClose,
  onSaved,
}: {
  task?: Task;
  fixedLead?: PickedLead;
  onClose: () => void;
  /** `null` quando a tarefa foi criada também no provedor (a tela só recarrega). */
  onSaved: (task: Task | null) => void;
}) {
  const { user } = useAuth();
  const { toast, toastError } = useToast();
  const { create, update } = useTaskActions();
  const { data: team } = useTeamDirectory();

  const [lead, setLead] = useState<PickedLead | null>(
    fixedLead ?? (task?.leadId ? { id: task.leadId, name: task.leadName ?? "—" } : null),
  );
  const [title, setTitle] = useState(task?.title ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "media");
  const [due, setDue] = useState(
    task ? (task.dueAt ? isoToLocalInput(task.dueAt) : "") : defaultDueInput(),
  );
  const [assignee, setAssignee] = useState(task?.assigneeUserId ?? user?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState(task?.description ?? "");
  // Uma chave por abertura do formulário: reenviar não cria outra tarefa.
  const publishKey = useRef(crypto.randomUUID());

  const dueIso = localInputToIso(due);
  // Tarefa de lead exige vencimento; a pessoal (sem lead) pode ficar sem data.
  const personal = !lead;
  const dueOk = personal ? due === "" || dueIso !== null : dueIso !== null;
  const valid = title.trim().length > 0 && dueOk;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      let saved: Task | null = null;
      if (task) {
        saved = await update(task.id, {
          title: title.trim(),
          priority,
          ...(dueIso ? { dueAt: dueIso } : {}),
          ...(assignee && task.leadId ? { assigneeUserId: assignee } : {}),
        });
      } else if (target) {
        const published = await connectionsService.publishTask({
          connectionId: target,
          title: title.trim(),
          ...(dueIso ? { dueAt: dueIso } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(lead ? { leadId: lead.id } : {}),
          idempotencyKey: publishKey.current,
        });
        if (published.pushStatus === "failed") {
          toast("Salva no CRM, mas não foi possível criar no app externo. Tente de novo mais tarde.");
          onSaved(null);
          onClose();
          return;
        }
      } else {
        saved = await create({
          ...(lead ? { leadId: lead.id } : {}),
          title: title.trim(),
          priority,
          ...(dueIso ? { dueAt: dueIso } : {}),
          ...(notes.trim() ? { description: notes.trim() } : {}),
          ...(lead && assignee ? { assigneeUserId: assignee } : {}),
        });
      }
      toast(task ? "Tarefa atualizada" : "Tarefa criada");
      onSaved(saved);
      onClose();
    } catch (err) {
      toastError(err, task ? "Não foi possível salvar a tarefa." : "Não foi possível criar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={task ? "Editar tarefa" : "Nova tarefa"}
      subtitle="Campos com * são obrigatórios."
      onClose={onClose}
    >
      <form className={form.form} onSubmit={(e) => void handleSubmit(e)}>
        <div className={form.field}>
          <span className={form.label}>Lead</span>
          <LeadPicker value={lead} onChange={setLead} disabled={!!fixedLead || !!task} />
          {!lead && !task && (
            <span className={form.hint}>Sem lead, a tarefa é pessoal (só você vê).</span>
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
            placeholder="Ex.: Ligar para confirmar proposta"
            required
            autoFocus
          />
        </label>
        <div className={form.row}>
          <label className={form.field}>
            <span className={form.label}>
              Vencimento {!personal && <span aria-hidden="true">*</span>}
            </span>
            <input
              className={form.input}
              type="datetime-local"
              required={!personal}
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            <span className={form.hint}>Horário de {browserTimeZone()}</span>
          </label>
          <label className={form.field}>
            <span className={form.label}>Prioridade</span>
            <select
              className={form.select}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </label>
        </div>
        {lead && (
        <label className={form.field}>
          <span className={form.label}>Responsável</span>
          <select
            className={form.select}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            {!team && user && <option value={user.id}>Eu</option>}
            {team?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === user?.id ? `${m.name} (eu)` : m.name}
              </option>
            ))}
          </select>
        </label>
        )}
        {!task && (
          <label className={form.field}>
            <span className={form.label}>Observações</span>
            <textarea
              className={form.input}
              rows={2}
              maxLength={4000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        )}
        {!task && <PublishTargetSelect kind="task" value={target} onChange={setTarget} />}
        {due && dueIso === null && (
          <div className={form.error} role="alert">
            Data/hora inválida. Escolha o dia e o horário no calendário.
          </div>
        )}
        <div className={form.actions}>
          <Button type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={!valid || saving}>
            {saving ? "Salvando…" : task ? "Salvar" : "Criar tarefa"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
