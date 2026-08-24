import { tagsService } from "../services/TagsService";
import type { CreateTagInput, Tag } from "../types/tag";

export interface TagActions {
  create(input: CreateTagInput): Promise<Tag>;
  delete(id: string): Promise<void>;
}

export function useTagActions(): TagActions {
  return {
    create: (input) => tagsService.create(input),
    delete: (id) => tagsService.delete(id),
  };
}
