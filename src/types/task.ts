export type TaskPriority = "alta" | "media" | "baixa";

/** Recortes da tela de tarefas — mesmos do backend (`GET /tasks?scope=`).
 * "Hoje" é o dia no fuso America/Sao_Paulo, calculado no servidor. */
export type TaskScope = "overdue" | "today" | "upcoming" | "open" | "done" | "all";

export interface Task {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  priority: TaskPriority;
  done: boolean;
  /** ISO 8601 (UTC) — exibido no fuso do navegador. */
  dueAt: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  completedAt: string | null;
}

export interface TaskListQuery {
  scope: TaskScope;
  leadId?: string;
  assigneeUserId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateTaskInput {
  leadId: string;
  title: string;
  priority: TaskPriority;
  /** ISO 8601 COM fuso (o backend recusa horário sem fuso). */
  dueAt: string;
  /** Omitido = quem cria vira o responsável. */
  assigneeUserId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  priority?: TaskPriority;
  dueAt?: string;
  assigneeUserId?: string;
  done?: boolean;
}
