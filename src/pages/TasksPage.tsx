import { useState } from "react";
import { useTasks } from "../hooks/useTasks";
import { useTaskActions } from "../hooks/useTaskActions";
import { useLeads } from "../hooks/useLeads";
import { useToast } from "../hooks/useToast";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/common/Button";
import { shortDateLabel } from "../utils/dates";
import type { TaskPriority } from "../types/task";
import styles from "./TasksPage.module.css";

const PRIORITY_COLOR: Record<string, string> = { alta: "#ff6b6b", media: "#f5b13d", baixa: "#9aa6b2" };

export function TasksPage() {
  // Sem branch de `notImplemented` de propósito — mesma razão de
  // `DashboardPage.tsx`: `TasksApiRepository` já chama `GET /api/v1/tasks`
  // de verdade e nunca lança `NotImplementedError`.
  const { data, loading, error, reload } = useTasks();
  const { data: leadsPage } = useLeads({ pageSize: 200 });
  const { toggle, create, delete: deleteTask } = useTaskActions();
  const { toast } = useToast();

  const [leadId, setLeadId] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("media");
  const [dueAt, setDueAt] = useState("");

  async function handleToggle(taskId: string) {
    await toggle(taskId);
    reload();
  }

  async function handleCreate() {
    if (!leadId || !title.trim() || !dueAt) return;
    await create({ leadId, title: title.trim(), priority, dueAt: new Date(dueAt).toISOString() });
    setTitle("");
    setDueAt("");
    toast("Tarefa criada");
    reload();
  }

  async function handleDelete(taskId: string) {
    await deleteTask(taskId);
    toast("Tarefa removida");
    reload();
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Tarefas</h1>
      <p className={styles.pageSubtitle}>Follow-ups e pendências dos leads</p>

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
          placeholder="Título da tarefa…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className={styles.select}
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        >
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <input
          className={styles.input}
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
        <Button variant="primary" onClick={() => void handleCreate()} disabled={!leadId || !title.trim() || !dueAt}>
          Adicionar
        </Button>
      </div>

      {error && <EmptyState title="Não foi possível carregar as tarefas" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <div className={styles.list}>
          {data.length === 0 && <div className={styles.empty}>Nenhuma tarefa por aqui.</div>}
          {data.map((task) => (
            <div key={task.id} className={styles.row}>
              <button
                type="button"
                className={styles.checkbox}
                onClick={() => void handleToggle(task.id)}
                aria-label="Concluir tarefa"
              >
                {task.done ? "☑" : "☐"}
              </button>
              <div className={styles.info}>
                <div className={task.done ? `${styles.title} ${styles.done}` : styles.title}>{task.title}</div>
                <div className={styles.meta}>
                  {task.leadName} · vence {shortDateLabel(task.dueAt)}
                </div>
              </div>
              <span className={styles.priority} style={{ color: PRIORITY_COLOR[task.priority] }}>
                {task.priority}
              </span>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => void handleDelete(task.id)}
                aria-label="Remover tarefa"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
