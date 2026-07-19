import type { TasksRepository } from "../TasksRepository";
import type { Task } from "../../types/task";
import { delay } from "../../utils/errors";
import { mockState } from "./state";

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
}
