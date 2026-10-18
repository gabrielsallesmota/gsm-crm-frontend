import type { Task } from "../../../types/task";
import type { AsyncResourceState } from "../../../hooks/useAsyncResource";
import type { Page } from "../../../types/common";
import { formatDateTime, isOverdue } from "../../../utils/datetime";
import styles from "../LeadDrawer.module.css";

/** Tarefas do lead com a PRÓXIMA ação em destaque (primeira pendente por vencimento). */
export function TasksSection({
  tasks,
  onToggle,
  onCreate,
}: {
  tasks: AsyncResourceState<Page<Task>>;
  onToggle: (task: Task) => void;
  onCreate: () => void;
}) {
  const items = [...(tasks.data?.items ?? [])].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"),
  );
  const next = items.find((t) => !t.done);
  const nextLate = next ? isOverdue(next.dueAt, next.done) : false;
  const rest = items.filter((t) => t !== next);

  return (
    <section className={styles.section} aria-label="Tarefas">
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Tarefas</h3>
        <button type="button" className={styles.linkBtn} onClick={onCreate}>
          + Nova tarefa
        </button>
      </div>
      {tasks.loading && !tasks.data && <div className={styles.empty}>Carregando…</div>}
      {tasks.error && <div className={styles.empty}>Não foi possível carregar as tarefas.</div>}
      {tasks.data && items.length === 0 && (
        <div className={styles.empty}>Nenhuma tarefa para este lead.</div>
      )}
      {tasks.data && items.length > 0 && !next && (
        <div className={styles.empty}>Sem próxima ação: todas as tarefas estão concluídas.</div>
      )}
      {next && (
        <div
          className={nextLate ? `${styles.nextAction} ${styles.nextActionLate}` : styles.nextAction}
        >
          <div className={styles.nextActionLabel}>Próxima ação</div>
          <TaskRow task={next} onToggle={onToggle} />
        </div>
      )}
      {rest.map((t) => (
        <TaskRow key={t.id} task={t} onToggle={onToggle} />
      ))}
      {tasks.data && tasks.data.total > items.length && (
        <div className={styles.empty}>
          Mostrando {items.length} de {tasks.data.total} — veja todas em Tarefas.
        </div>
      )}
    </section>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (task: Task) => void }) {
  const late = isOverdue(task.dueAt, task.done);
  return (
    <div className={styles.taskRow}>
      <button
        type="button"
        className={styles.taskCheck}
        onClick={() => onToggle(task)}
        aria-label={task.done ? "Reabrir tarefa" : "Concluir tarefa"}
      >
        {task.done ? "☑" : "☐"}
      </button>
      <div className={styles.taskBody}>
        <div className={task.done ? styles.taskDone : undefined}>{task.title}</div>
        <div className={late ? `${styles.taskMeta} ${styles.overdue}` : styles.taskMeta}>
          {late ? "Atrasada · " : ""}
          {formatDateTime(task.dueAt)}
          {task.assigneeName ? ` · ${task.assigneeName}` : ""}
        </div>
      </div>
    </div>
  );
}
