import type { CreateTagInput, Tag } from "../types/tag";

export interface TagsRepository {
  list(): Promise<Tag[]>;
  create(input: CreateTagInput): Promise<Tag>;
  delete(id: string): Promise<void>;
}
