export type TaskPriority = "alta" | "media" | "baixa";

export interface Task {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  priority: TaskPriority;
  done: boolean;
  dueAt: string;
}
