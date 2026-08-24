export type CalEventType = "retorno" | "reuniao" | "visita";

export interface CalEvent {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  type: CalEventType;
  at: string;
  time: string;
}

export interface CreateCalEventInput {
  leadId: string;
  title: string;
  type: CalEventType;
  at: string;
}
