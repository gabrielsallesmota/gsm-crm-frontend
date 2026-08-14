import type { TagsRepository } from "../TagsRepository";
import type { Tag } from "../../types/tag";
import { delay } from "../../utils/errors";
import { mockTags } from "../../mock/tags";

export class TagsMockRepository implements TagsRepository {
  async list(): Promise<Tag[]> {
    await delay(150);
    return mockTags;
  }
}
