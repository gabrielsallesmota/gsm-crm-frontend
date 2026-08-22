import type { TagsRepository } from "../repositories/TagsRepository";
import { TagsApiRepository } from "../repositories/api/TagsApiRepository";
import { TagsMockRepository } from "../repositories/mock/TagsMockRepository";
import { selectRepository } from "./factory";
import type { Tag } from "../types/tag";

const repo: TagsRepository = selectRepository(
  () => new TagsMockRepository(),
  () => new TagsApiRepository(),
);

export class TagsService {
  list(): Promise<Tag[]> {
    return repo.list();
  }
}

export const tagsService = new TagsService();
