import type { TagsRepository } from "../TagsRepository";
import type { CreateTagInput, Tag } from "../../types/tag";
import { apiRequest } from "./ApiClient";

interface TagDto {
  id: string;
  label: string;
  color: string;
  bg: string;
}

function toTag(dto: TagDto): Tag {
  return { id: dto.id, label: dto.label, color: dto.color, bg: dto.bg };
}

export class TagsApiRepository implements TagsRepository {
  async list(): Promise<Tag[]> {
    const dtos = await apiRequest<TagDto[]>("/api/v1/tags");
    return dtos.map(toTag);
  }

  async create(input: CreateTagInput): Promise<Tag> {
    const dto = await apiRequest<TagDto>("/api/v1/tags", {
      method: "POST",
      body: JSON.stringify({ label: input.label, color: input.color, bg: input.bg }),
    });
    return toTag(dto);
  }

  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/tags/${id}`, { method: "DELETE" });
  }
}
