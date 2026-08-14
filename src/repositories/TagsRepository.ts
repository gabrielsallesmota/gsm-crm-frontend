import type { Tag } from "../types/tag";

export interface TagsRepository {
  list(): Promise<Tag[]>;
}
