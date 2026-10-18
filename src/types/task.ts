import type { ItemSource } from "./connections";

export type TaskPriority = "alta" | "media" | "baixa";

/** Recortes da tela de tarefas — mesmos do backend (`GET /tasks?scope=`).
 * "Hoje" é o dia no fuso America/Sao_Paulo, calculado no servidor. */
export type TaskScope = "overdue" | "today" | "upcoming" | "open" | "done" | "all";

export interface Task {
  id: string;
  /** `null` = tarefa pessoal ou importada (sem lead). */
  leadId: string | null;
  leadName: string | null;
  title: string;
  priority: TaskPriority;
  done: boolean;
  /** ISO 8601 (UTC) — exibido no fuso do navegador. `null` = sem data. */
  dueAt: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  completedAt: string | null;
  description?: string | null;
  /** Vencimento sem hora (Google Tasks guarda só o dia). */
  dueDateOnly?: boolean;
  /** Origem na agenda unificada; ausente = CRM. */
  source?: ItemSource;
  /** Cópia do Google/Microsoft: só leitura aqui. */
  readOnly?: boolean;
  /** Link para abrir o item no provedor de origem. */
  externalUrl?: string | null;
  /** Tarefa ligada a um cliente/contrato (ex.: "Renovação — cliente"). */
  clientId?: string | null;
  contractId?: string | null;
}

export interface TaskListQuery {
  scope: TaskScope;
  leadId?: string;
  assigneeUserId?: string;
  source?: ItemSource;
  page?: number;
  pageSize?: number;
}

export interface CreateTaskInput {
  /** Omitido = tarefa pessoal (vencimento opcional). */
  leadId?: string;
  title: string;
  priority: TaskPriority;
  /** ISO 8601 COM fuso (o backend recusa horário sem fuso). */
  dueAt?: string;
  description?: string;
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
