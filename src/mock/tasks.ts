import type { Task } from "../types/task";
import { mockLeads } from "./leads";

export function buildMockTasks(): Task[] {
  const out: Task[] = [];
  for (const lead of mockLeads) {
    for (const t of lead.tasks) {
      out.push({
        id: t.id,
        leadId: lead.id,
        leadName: lead.name,
        title: t.title,
        priority: t.priority,
        done: t.done,
        dueAt: t.dueAt,
      });
    }
  }
  return out;
}
