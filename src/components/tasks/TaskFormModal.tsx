import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { LeadPicker, type PickedLead } from "../leads/LeadPicker";
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
  onSaved: (task: Task) => void;
}) {
  const { user } = useAuth();
  const { toast, toastError } = useToast();
  const { create, update } = useTaskActions();
  const { data: team } = useTeamDirectory();

  const [lead, setLead] = useState<PickedLead | null>(
    fixedLead ?? (task ? { id: task.leadId, name: task.leadName } : null),
  );
  const [title, setTitle] = useState(task?.title ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "media");
  const [due, setDue] = useState(task ? isoToLocalInput(task.dueAt) : defaultDueInput());
  const [assignee, setAssignee] = useState(task?.assigneeUserId ?? user?.id ?? "");
  const [saving, setSaving] = useState(false);

  const dueIso = localInputToIso(due);
  const valid = !!lead && title.trim().length > 0 && dueIso !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !lead || !dueIso) return;
    setSaving(true);
    try {
      const saved = task
        ? await update(task.id, {
            title: title.trim(),
            priority,
            dueAt: dueIso,
            ...(assignee ? { assigneeUserId: assignee } : {}),
          })
        : await create({
            leadId: lead.id,
            title: title.trim(),
            priority,
            dueAt: dueIso,
            ...(assignee ? { assigneeUserId: assignee } : {}),
          });
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
    <Modal title={task ? "Editar tarefa" : "Nova tarefa"} onClose={onClose}>
      <form className={form.form} onSubmit={(e) => void handleSubmit(e)}>
        <div className={form.field}>
          <span className={form.label}>Lead</span>
          <LeadPicker value={lead} onChange={setLead} disabled={!!fixedLead || !!task} />
        </div>
        <label className={form.field}>
          <span className={form.label}>Título</span>
          <input
            className={form.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Ex.: Ligar para confirmar proposta"
            autoFocus
          />
        </label>
        <div className={form.row}>
          <label className={form.field}>
            <span className={form.label}>Vencimento</span>
            <input
              className={form.input}
              type="datetime-local"
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
        {due && dueIso === null && <div className={form.error}>Data/hora inválida.</div>}
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
