import type {
  CalEvent,
  CalendarRange,
  CreateCalEventInput,
  UpdateCalEventInput,
} from "../types/event";

export interface CalendarRepository {
  listEvents(range?: CalendarRange): Promise<CalEvent[]>;
  create(input: CreateCalEventInput): Promise<CalEvent>;
  update(eventId: string, input: UpdateCalEventInput): Promise<CalEvent>;
  delete(eventId: string): Promise<void>;
}
