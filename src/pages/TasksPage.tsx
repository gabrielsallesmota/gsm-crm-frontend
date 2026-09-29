import { useState } from "react";
import { useTasks } from "../hooks/useTasks";
import { useTaskActions } from "../hooks/useTaskActions";
import { useTeamDirectory } from "../hooks/useTeamDirectory";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";
import { can } from "../auth/permissions";
import { EmptyState, type EmptyAction } from "../components/common/EmptyState";
import { SkeletonRows } from "../components/common/Skeleton";
import { HelpTip } from "../components/common/HelpTip";
import { usePageTitle } from "../hooks/usePageTitle";
import { ROUTES } from "../constants/routes";
import { Button } from "../components/common/Button";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { TaskFormModal } from "../components/tasks/TaskFormModal";
import { formatDateTime, isOverdue } from "../utils/datetime";
import { pageCount, rangeLabel } from "../utils/pagination";
import type { Task, TaskScope } from "../types/task";
import styles from "./TasksPage.module.css";

const PRIORITY_COLOR: Record<string, string> = {
  alta: "var(--tone-red)",
  media: "var(--tone-amber)",
  baixa: "var(--tone-gray)",
};
const PRIORITY_LABEL: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

/** Abas = recortes do backend (`scope`); "Hoje" é o dia em America/Sao_Paulo
 * calculado no servidor. */
const SCOPES: { value: TaskScope; label: string }[] = [
  { value: "overdue", label: "Atrasadas" },
  { value: "today", label: "Hoje" },
  { value: "upcoming", label: "Próximas" },
  { value: "open", label: "Todas em aberto" },
  { value: "done", label: "Concluídas" },
];

const PAGE_SIZE = 25;

/** Texto do estado vazio por aba (Etapa 4) — "vazio" em Atrasadas é boa
 * notícia; em "Todas em aberto" é hora de criar a primeira. */
const EMPTY_COPY: Record<TaskScope, { title: string; message: string; good: boolean }> = {
  overdue: {
    title: "Nenhuma tarefa atrasada",
    message: "Tudo em dia por aqui.",
    good: true,
  },
  today: {
    title: "Nada vencendo hoje",
    message: "Veja as próximas ou crie um lembrete para um lead.",
    good: true,
  },
  upcoming: {
    title: "Nenhuma tarefa agendada para os próximos dias",
    message: "Agende o próximo contato com seus leads para não perder o timing da venda.",
    good: false,
  },
  open: {
    title: "Nenhuma tarefa em aberto",
    message:
      "Tarefas são lembretes do próximo passo com um lead: ligar, enviar proposta, cobrar retorno. Crie uma aqui ou direto na ficha do lead.",
    good: false,
  },
  done: {
    title: "Nenhuma tarefa concluída ainda",
    message: "Quando você marcar uma tarefa como feita, ela aparece aqui.",
    good: false,
  },
  all: {
    title: "Nenhuma tarefa",
    message: "Crie a primeira tarefa para um lead.",
    good: false,
  },
};

export function TasksPage() {
  const { user } = useAuth();
  const canSeeTeam = can(user, "leads.viewAll");
  const [scope, setScope] = useState<TaskScope>("open");
  // "" = todos que eu posso ver; senão o id do responsável.
  const [assignee, setAssignee] = useState(canSeeTeam ? "" : (user?.id ?? ""));
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useTasks({
    scope,
    page,
    pageSize: PAGE_SIZE,
    ...(assignee ? { assigneeUserId: assignee } : {}),
  });
  const { data: team } = useTeamDirectory();
  const { setDone, delete: deleteTask } = useTaskActions();
  const { toast, toastError } = useToast();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  usePageTitle("Tarefas");

  function changeScope(next: TaskScope) {
    setScope(next);
    setPage(1);
  }

  async function handleToggle(task: Task) {
    setBusyId(task.id);
    try {
      await setDone(task.id, !task.done);
      toast(task.done ? "Tarefa reaberta" : "Tarefa concluída");
      reload();
    } catch (err) {
      toastError(err, "Não foi possível atualizar a tarefa.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(task: Task): Promise<boolean> {
    try {
      await deleteTask(task.id);
      toast("Tarefa excluída");
      // Excluiu o último item da última página → volta uma página.
      if (data && data.items.length === 1 && page > 1) setPage((p) => p - 1);
      else reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível excluir a tarefa.");
      return false;
    }
  }

  const tasks = data?.items ?? [];
  const totalPages = data ? pageCount(data.total, PAGE_SIZE) : 1;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Tarefas</h1>
          <p className={styles.pageSubtitle}>
            Follow-ups e pendências dos leads
            <HelpTip label="Tarefas">
              <span>
                Cada tarefa pertence a um lead e tem um responsável e um vencimento. Marque o
                quadrado para concluir; o lápis edita ou reagenda.
              </span>
              <span>
                &quot;Hoje&quot; e &quot;Atrasadas&quot; usam o horário de Brasília. Tarefas criadas
                na ficha do lead aparecem aqui também.
              </span>
            </HelpTip>
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Nova tarefa
        </Button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Recorte das tarefas">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={scope === s.value}
              className={scope === s.value ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => changeScope(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          className={styles.select}
          value={assignee}
          onChange={(e) => {
            setAssignee(e.target.value);
            setPage(1);
          }}
          aria-label="Responsável"
        >
          <option value="">{canSeeTeam ? "Toda a equipe" : "Minhas e dos meus leads"}</option>
          {user && <option value={user.id}>Atribuídas a mim</option>}
          {canSeeTeam &&
            team
              ?.filter((m) => m.id !== user?.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
        </select>
      </div>

      {error && (
        <EmptyState
          tone="error"
          title="Não foi possível carregar as tarefas"
          message={error.message}
          actions={[{ label: "Tentar de novo", onClick: reload }]}
        />
      )}
      {loading && !data && !error && <SkeletonRows rows={5} label="Carregando tarefas" />}

      {data && (
        <div className={styles.list} aria-busy={loading}>
          {tasks.length === 0 && (
            <EmptyState
              compact
              tone={EMPTY_COPY[scope].good ? "done" : "empty"}
              title={EMPTY_COPY[scope].title}
              message={EMPTY_COPY[scope].message}
              actions={
                [
                  { label: "Nova tarefa", onClick: () => setCreating(true) },
                  ...(EMPTY_COPY[scope].good
                    ? [{ label: "Ver próximas", onClick: () => changeScope("upcoming") }]
                    : [{ label: "Ver leads", to: ROUTES.leads }]),
                ] satisfies EmptyAction[]
              }
            />
          )}
          {tasks.map((task) => {
            const overdue = isOverdue(task.dueAt, task.done);
            return (
              <div key={task.id} className={overdue ? `${styles.row} ${styles.rowOverdue}` : styles.row}>
                <button
                  type="button"
                  className={styles.checkbox}
                  onClick={() => void handleToggle(task)}
                  disabled={busyId === task.id}
                  aria-label={`${task.done ? "Reabrir" : "Concluir"} tarefa: ${task.title}`}
                  aria-pressed={task.done}
                >
                  <span aria-hidden="true">{task.done ? "☑" : "☐"}</span>
                </button>
                <div className={styles.info}>
                  <div className={task.done ? `${styles.title} ${styles.done}` : styles.title}>
                    {task.title}
                  </div>
                  <div className={styles.meta}>
                    {task.leadName} ·{" "}
                    <span className={overdue ? styles.overdue : undefined}>
                      {overdue ? "atrasada — " : ""}vence {formatDateTime(task.dueAt)}
                    </span>
                    {task.assigneeName ? ` · ${task.assigneeName}` : ""}
                    {task.done && task.completedAt ? ` · concluída ${formatDateTime(task.completedAt)}` : ""}
                  </div>
                </div>
                <span className={styles.priority} style={{ color: PRIORITY_COLOR[task.priority] }}>
                  {PRIORITY_LABEL[task.priority] ?? task.priority}
                </span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => setEditing(task)}
                  aria-label={`Editar ou reagendar: ${task.title}`}
                  title="Editar / reagendar"
                >
                  ✎
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => setDeleting(task)}
                  aria-label={`Excluir tarefa: ${task.title}`}
                  title="Excluir"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className={styles.pagination}>
          <span>{rangeLabel(page, PAGE_SIZE, data.total)}</span>
          <div className={styles.paginationBtns}>
            <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
              ← Anterior
            </Button>
            <span>
              Página {page} de {totalPages}
            </span>
            <Button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Próxima →
            </Button>
          </div>
        </div>
      )}

      {creating && <TaskFormModal onClose={() => setCreating(false)} onSaved={() => reload()} />}
      {editing && (
        <TaskFormModal task={editing} onClose={() => setEditing(null)} onSaved={() => reload()} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Excluir tarefa?"
          message={`"${deleting.title}" (${deleting.leadName}) será excluída. Esta ação não pode ser desfeita.`}
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
