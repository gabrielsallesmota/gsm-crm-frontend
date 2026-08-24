import type { CalEvent, CreateCalEventInput } from "../types/event";

export interface CalendarRepository {
  listEvents(): Promise<CalEvent[]>;
  create(input: CreateCalEventInput): Promise<CalEvent>;
  delete(eventId: string): Promise<void>;
}
