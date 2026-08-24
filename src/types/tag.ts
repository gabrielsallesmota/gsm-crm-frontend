export interface Tag {
  id: string;
  label: string;
  color: string;
  bg: string;
}

export type CreateTagInput = Pick<Tag, "label" | "color" | "bg">;
