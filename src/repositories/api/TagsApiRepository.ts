import type { TagsRepository } from "../TagsRepository";
import type { Tag } from "../../types/tag";
import { NotImplementedError } from "../../utils/errors";

export class TagsApiRepository implements TagsRepository {
  async list(): Promise<Tag[]> {
    throw new NotImplementedError("Tags");
  }
}
