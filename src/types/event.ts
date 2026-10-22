import type { ItemSource } from "./connections";

export type CalEventType = "retorno" | "reuniao" | "visita";

export interface CalEvent {
  id: string;
  /** `null` = compromisso pessoal ou importado (sem lead). */
  leadId: string | null;
  leadName: string | null;
  title: string;
  type: CalEventType;
  /** ISO 8601 (UTC) — exibido no fuso do navegador. */
  at: string;
  time: string;
  endsAt?: string | null;
  allDay?: boolean;
  /** Origem na agenda unificada; ausente = CRM. */
  source?: ItemSource;
  /** Cópia do Google/Microsoft: só leitura aqui. */
  readOnly?: boolean;
  /** Link para abrir o evento no provedor de origem. */
  externalUrl?: string | null;
  /** Pessoa a quem o compromisso foi atrelado (recebe aviso). */
  assigneeUserId?: string | null;
  assigneeName?: string | null;
}

export interface CreateCalEventInput {
  /** Omitido = compromisso pessoal. */
  leadId?: string;
  title: string;
  type: CalEventType;
  /** ISO 8601 COM fuso. */
  at: string;
  endsAt?: string;
  /** Atrela a outra pessoa da equipe (ela é avisada). */
  assigneeUserId?: string;
}

export type UpdateCalEventInput = Partial<Pick<CreateCalEventInput, "title" | "type" | "at" | "assigneeUserId">>;

/** Janela de datas (ISO 8601): `from` inclusivo, `to` exclusivo. */
export interface CalendarRange {
  from?: string;
  to?: string;
  leadId?: string;
  source?: ItemSource;
}
