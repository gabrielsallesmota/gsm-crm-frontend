export type InboxKind = "task_assigned" | "task_team" | "event_assigned";

/** Aviso no sino do CRM (ex.: “Ana atribuiu uma tarefa a você”). */
export interface InboxItem {
  id: string;
  kind: InboxKind;
  title: string;
  body: string;
  /** Rota interna para abrir ao clicar (ex.: `/tarefas`). */
  link: string | null;
  createdAt: string;
  read: boolean;
}

export interface InboxPage {
  items: InboxItem[];
  unread: number;
}
