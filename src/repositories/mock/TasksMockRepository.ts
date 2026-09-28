import type { TasksRepository } from "../TasksRepository";
import type { Page } from "../../types/common";
import type { CreateTaskInput, Task, TaskListQuery, UpdateTaskInput } from "../../types/task";
import { delay } from "../../utils/errors";
import { mockState, nextTaskId } from "./state";

function endOfToday(): number {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

function matchesScope(task: Task, scope: TaskListQuery["scope"]): boolean {
  const due = new Date(task.dueAt).getTime();
  const now = Date.now();
  switch (scope) {
    case "done":
      return task.done;
    case "all":
      return true;
    case "overdue":
      return !task.done && due < now;
    case "today":
      return !task.done && due >= now && due < endOfToday();
    case "upcoming":
      return !task.done && due >= endOfToday();
    default:
      return !task.done;
  }
}

export class TasksMockRepository implements TasksRepository {
  async list(query: TaskListQuery): Promise<Page<Task>> {
    await delay(200);
    const tenantLeads = new Set(
      mockState.leads.filter((l) => l.tenantId === mockState.currentTenantId).map((l) => l.id),
    );
    const items = mockState.tasks
      .filter((t) => tenantLeads.has(t.leadId))
      .filter((t) => !query.leadId || t.leadId === query.leadId)
      .filter((t) => !query.assigneeUserId || t.assigneeUserId === query.assigneeUserId)
      .filter((t) => matchesScope(t, query.scope))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
  }

  async create(input: CreateTaskInput): Promise<Task> {
    await delay(200);
    const lead = mockState.leads.find((l) => l.id === input.leadId);
    if (!lead) throw new Error(`Lead ${input.leadId} não encontrado.`);
    const assignee = input.assigneeUserId ?? mockState.users[0]?.id ?? null;
    const task: Task = {
      id: nextTaskId(),
      leadId: lead.id,
      leadName: lead.name,
      title: input.title,
      priority: input.priority,
      done: false,
      dueAt: input.dueAt,
      assigneeUserId: assignee,
      assigneeName: mockState.users.find((u) => u.id === assignee)?.name ?? null,
      completedAt: null,
    };
    mockState.tasks.push(task);
    return task;
  }

  async update(taskId: string, input: UpdateTaskInput): Promise<Task> {
    await delay(150);
    const task = mockState.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Tarefa ${taskId} não encontrada.`);
    if (input.title !== undefined) task.title = input.title;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.dueAt !== undefined) task.dueAt = input.dueAt;
    if (input.assigneeUserId !== undefined) {
      task.assigneeUserId = input.assigneeUserId;
      task.assigneeName = mockState.users.find((u) => u.id === input.assigneeUserId)?.name ?? null;
    }
    if (input.done !== undefined) {
      task.done = input.done;
      task.completedAt = input.done ? new Date().toISOString() : null;
    }
    return task;
  }

  async delete(taskId: string): Promise<void> {
    await delay(150);
    mockState.tasks = mockState.tasks.filter((t) => t.id !== taskId);
  }
}
