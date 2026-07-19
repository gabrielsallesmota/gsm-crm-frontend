import type { CalendarRepository } from "../CalendarRepository";
import type { CalEvent } from "../../types/event";
import { NotImplementedError } from "../../utils/errors";

export class CalendarApiRepository implements CalendarRepository {
  async listEvents(): Promise<CalEvent[]> {
    throw new NotImplementedError("Agenda");
  }
}
