import type { TasksRepository } from "../TasksRepository";
import type { CreateTaskInput, Task } from "../../types/task";
import { apiRequest } from "./ApiClient";

interface TaskDto {
  id: string;
  lead_id: string;
  lead_name: string;
  title: string;
  priority: Task["priority"];
  done: boolean;
  due_at: string;
}

function toTask(dto: TaskDto): Task {
  return {
    id: dto.id,
    leadId: dto.lead_id,
    leadName: dto.lead_name,
    title: dto.title,
    priority: dto.priority,
    done: dto.done,
    dueAt: dto.due_at,
  };
}

export class TasksApiRepository implements TasksRepository {
  async list(): Promise<Task[]> {
    const dtos = await apiRequest<TaskDto[]>("/api/v1/tasks");
    return dtos.map(toTask);
  }

  async toggle(taskId: string): Promise<Task> {
    const dto = await apiRequest<TaskDto>(`/api/v1/tasks/${taskId}/toggle`, { method: "PATCH" });
    return toTask(dto);
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const dto = await apiRequest<TaskDto>("/api/v1/tasks", {
      method: "POST",
      body: JSON.stringify({
        lead_id: input.leadId,
        title: input.title,
        priority: input.priority,
        due_at: input.dueAt,
      }),
    });
    return toTask(dto);
  }

  async delete(taskId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
  }
}
