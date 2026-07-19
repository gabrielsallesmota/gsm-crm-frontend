import type { CalendarRepository } from "../repositories/CalendarRepository";
import { CalendarApiRepository } from "../repositories/api/CalendarApiRepository";
import { CalendarMockRepository } from "../repositories/mock/CalendarMockRepository";
import { CRM_MODE } from "./factory";
import type { CalEvent } from "../types/event";

const repo: CalendarRepository = CRM_MODE === "demo" ? new CalendarMockRepository() : new CalendarApiRepository();

export class CalendarService {
  listEvents(): Promise<CalEvent[]> {
    return repo.listEvents();
  }
}

export const calendarService = new CalendarService();
