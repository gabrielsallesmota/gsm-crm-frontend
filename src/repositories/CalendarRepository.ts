import type { CalEvent } from "../types/event";

export interface CalendarRepository {
  listEvents(): Promise<CalEvent[]>;
}
