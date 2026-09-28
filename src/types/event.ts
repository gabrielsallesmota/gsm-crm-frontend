export type CalEventType = "retorno" | "reuniao" | "visita";

export interface CalEvent {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  type: CalEventType;
  /** ISO 8601 (UTC) — exibido no fuso do navegador. */
  at: string;
  time: string;
}

export interface CreateCalEventInput {
  leadId: string;
  title: string;
  type: CalEventType;
  /** ISO 8601 COM fuso. */
  at: string;
}

export type UpdateCalEventInput = Partial<Pick<CreateCalEventInput, "title" | "type" | "at">>;

/** Janela de datas (ISO 8601): `from` inclusivo, `to` exclusivo. */
export interface CalendarRange {
  from?: string;
  to?: string;
  leadId?: string;
}
