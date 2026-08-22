import { useTasks } from "../hooks/useTasks";
import { useTaskActions } from "../hooks/useTaskActions";
import { EmptyState } from "../components/common/EmptyState";
import { shortDateLabel } from "../utils/dates";
import styles from "./TasksPage.module.css";

const PRIORITY_COLOR: Record<string, string> = { alta: "#ff6b6b", media: "#f5b13d", baixa: "#9aa6b2" };

export function TasksPage() {
  const { data, loading, error, notImplemented, reload } = useTasks();
  const { toggle } = useTaskActions();

  async function handleToggle(taskId: string) {
    await toggle(taskId);
    reload();
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Tarefas</h1>
      <p className={styles.pageSubtitle}>Follow-ups e pendências dos leads</p>

      {notImplemented && (
        <EmptyState
          title="Tarefas disponíveis apenas no modo Demo por enquanto"
          message="O backend ainda não tem um módulo de tarefas — só autenticação, leads e pipelines. A tela é a mesma; falta só a origem dos dados em produção."
        />
      )}
      {error && !notImplemented && <EmptyState title="Não foi possível carregar as tarefas" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <div className={styles.list}>
          {data.length === 0 && <div className={styles.empty}>Nenhuma tarefa por aqui.</div>}
          {data.map((task) => (
            <div key={task.id} className={styles.row}>
              <button className={styles.checkbox} onClick={() => void handleToggle(task.id)} aria-label="Concluir tarefa">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
