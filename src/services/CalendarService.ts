import type { CalendarRepository } from "../repositories/CalendarRepository";
import { CalendarApiRepository } from "../repositories/api/CalendarApiRepository";
import { CalendarMockRepository } from "../repositories/mock/CalendarMockRepository";
import { selectRepository } from "./factory";
import type { CalEvent, CreateCalEventInput } from "../types/event";

const repo: CalendarRepository = selectRepository(
  () => new CalendarMockRepository(),
  () => new CalendarApiRepository(),
);

export class CalendarService {
  listEvents(): Promise<CalEvent[]> {
    return repo.listEvents();
  }

  create(input: CreateCalEventInput): Promise<CalEvent> {
    return repo.create(input);
  }

  delete(eventId: string): Promise<void> {
    return repo.delete(eventId);
  }
}

export const calendarService = new CalendarService();
