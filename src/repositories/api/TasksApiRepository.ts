import type { TasksRepository } from "../TasksRepository";
import type { Page } from "../../types/common";
import type {
  CreateTaskInput,
  Task,
  TaskListQuery,
  UpdateTaskInput,
} from "../../types/task";
import { apiRequest } from "./ApiClient";

interface TaskDto {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  title: string;
  priority: Task["priority"];
  done: boolean;
  due_at: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  completed_at: string | null;
  description?: string | null;
  due_date_only?: boolean;
  source?: Task["source"];
  read_only?: boolean;
  external_url?: string | null;
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
    assigneeUserId: dto.assignee_user_id,
    assigneeName: dto.assignee_name,
    completedAt: dto.completed_at,
    description: dto.description ?? null,
    dueDateOnly: dto.due_date_only === true,
    source: dto.source ?? "crm",
    readOnly: dto.read_only === true,
    externalUrl: dto.external_url ?? null,
  };
}

export class TasksApiRepository implements TasksRepository {
  async list(query: TaskListQuery): Promise<Page<Task>> {
    const params = new URLSearchParams({ scope: query.scope });
    if (query.leadId) params.set("lead_id", query.leadId);
    if (query.assigneeUserId) params.set("assignee_user_id", query.assigneeUserId);
    if (query.source) params.set("source", query.source);
    params.set("page", String(query.page ?? 1));
    params.set("page_size", String(query.pageSize ?? 25));
    const dto = await apiRequest<{ items: TaskDto[]; total: number; page: number; page_size: number }>(
      `/api/v1/tasks?${params.toString()}`,
    );
    return { items: dto.items.map(toTask), total: dto.total, page: dto.page, pageSize: dto.page_size };
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const dto = await apiRequest<TaskDto>("/api/v1/tasks", {
      method: "POST",
      body: JSON.stringify({
        lead_id: input.leadId,
        title: input.title,
        priority: input.priority,
        due_at: input.dueAt,
        assignee_user_id: input.assigneeUserId,
        description: input.description,
      }),
    });
    return toTask(dto);
  }

  async update(taskId: string, input: UpdateTaskInput): Promise<Task> {
    const dto = await apiRequest<TaskDto>(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: input.title,
        priority: input.priority,
        due_at: input.dueAt,
        assignee_user_id: input.assigneeUserId,
        done: input.done,
      }),
    });
    return toTask(dto);
  }

  async delete(taskId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
  }
}
