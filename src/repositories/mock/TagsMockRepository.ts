import type { TagsRepository } from "../TagsRepository";
import type { CreateTagInput, Tag } from "../../types/tag";
import { delay } from "../../utils/errors";
import { mockState, nextTagId } from "./state";

export class TagsMockRepository implements TagsRepository {
  async list(): Promise<Tag[]> {
    await delay(150);
    return mockState.tags;
  }

  async create(input: CreateTagInput): Promise<Tag> {
    await delay(150);
    const tag: Tag = { id: nextTagId(), label: input.label, color: input.color, bg: input.bg };
    mockState.tags.push(tag);
    return tag;
  }

  async delete(id: string): Promise<void> {
    await delay(150);
    const index = mockState.tags.findIndex((t) => t.id === id);
    if (index >= 0) mockState.tags.splice(index, 1);
  }
}
