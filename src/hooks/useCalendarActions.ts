import { calendarService } from "../services/CalendarService";
import type { CalEvent, CreateCalEventInput } from "../types/event";

export interface CalendarActions {
  create(input: CreateCalEventInput): Promise<CalEvent>;
  delete(eventId: string): Promise<void>;
}

export function useCalendarActions(): CalendarActions {
  return {
    create: (input) => calendarService.create(input),
    delete: (eventId) => calendarService.delete(eventId),
  };
}
