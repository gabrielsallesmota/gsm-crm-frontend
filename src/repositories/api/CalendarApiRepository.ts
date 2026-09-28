import type { CalendarRepository } from "../CalendarRepository";
import type {
  CalEvent,
  CalendarRange,
  CreateCalEventInput,
  UpdateCalEventInput,
} from "../../types/event";
import { apiRequest } from "./ApiClient";
import { shortTimeLabel } from "../../utils/dates";

interface CalendarEventDto {
  id: string;
  lead_id: string;
  lead_name: string;
  title: string;
  type: CalEvent["type"];
  at: string;
}

function toCalEvent(dto: CalendarEventDto): CalEvent {
  return {
    id: dto.id,
    leadId: dto.lead_id,
    leadName: dto.lead_name,
    title: dto.title,
    type: dto.type,
    at: dto.at,
    // O backend não guarda um `time` separado — só `at` (datetime completo).
    time: shortTimeLabel(dto.at),
  };
}

export class CalendarApiRepository implements CalendarRepository {
  async listEvents(range?: CalendarRange): Promise<CalEvent[]> {
    const params = new URLSearchParams();
    if (range?.from) params.set("date_from", range.from);
    if (range?.to) params.set("date_to", range.to);
    if (range?.leadId) params.set("lead_id", range.leadId);
    const query = params.toString();
    const dtos = await apiRequest<CalendarEventDto[]>(
      query ? `/api/v1/calendar/events?${query}` : "/api/v1/calendar/events",
    );
    return dtos.map(toCalEvent);
  }

  async create(input: CreateCalEventInput): Promise<CalEvent> {
    const dto = await apiRequest<CalendarEventDto>("/api/v1/calendar/events", {
      method: "POST",
      body: JSON.stringify({
        lead_id: input.leadId,
        title: input.title,
        type: input.type,
        at: input.at,
      }),
    });
    return toCalEvent(dto);
  }

  async update(eventId: string, input: UpdateCalEventInput): Promise<CalEvent> {
    const dto = await apiRequest<CalendarEventDto>(`/api/v1/calendar/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: input.title, type: input.type, at: input.at }),
    });
    return toCalEvent(dto);
  }

  async delete(eventId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/calendar/events/${eventId}`, { method: "DELETE" });
  }
}
