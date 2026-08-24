import type { TasksRepository } from "../TasksRepository";
import type { CreateTaskInput, Task } from "../../types/task";
import { delay } from "../../utils/errors";
import { mockState, nextTaskId } from "./state";

export class TasksMockRepository implements TasksRepository {
  async list(): Promise<Task[]> {
    await delay(200);
    const out: Task[] = [];
    for (const lead of mockState.leads.filter((l) => l.tenantId === mockState.currentTenantId)) {
      for (const t of lead.tasks) {
        out.push({ id: t.id, leadId: lead.id, leadName: lead.name, title: t.title, priority: t.priority, done: t.done, dueAt: t.dueAt });
      }
    }
    return out;
  }

  async toggle(taskId: string): Promise<Task> {
    await delay(150);
    for (const lead of mockState.leads) {
      const task = lead.tasks.find((t) => t.id === taskId);
      if (task) {
        task.done = !task.done;
        return { id: task.id, leadId: lead.id, leadName: lead.name, title: task.title, priority: task.priority, done: task.done, dueAt: task.dueAt };
      }
    }
    throw new Error(`Tarefa ${taskId} não encontrada.`);
  }

  async create(input: CreateTaskInput): Promise<Task> {
    await delay(200);
    const lead = mockState.leads.find((l) => l.id === input.leadId);
    if (!lead) throw new Error(`Lead ${input.leadId} não encontrado.`);
    const task = { id: nextTaskId(), title: input.title, priority: input.priority, done: false, dueAt: input.dueAt };
    lead.tasks.push(task);
    return { id: task.id, leadId: lead.id, leadName: lead.name, title: task.title, priority: task.priority, done: task.done, dueAt: task.dueAt };
  }

  async delete(taskId: string): Promise<void> {
    await delay(150);
    for (const lead of mockState.leads) {
      const index = lead.tasks.findIndex((t) => t.id === taskId);
      if (index >= 0) {
        lead.tasks.splice(index, 1);
        return;
      }
    }
  }
}
