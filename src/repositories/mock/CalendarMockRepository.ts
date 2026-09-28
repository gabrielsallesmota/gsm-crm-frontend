import type { CalendarRepository } from "../CalendarRepository";
import type {
  CalEvent,
  CalendarRange,
  CreateCalEventInput,
  UpdateCalEventInput,
} from "../../types/event";
import { delay } from "../../utils/errors";
import { shortTimeLabel } from "../../utils/dates";
import { mockState, nextEventId } from "./state";

export class CalendarMockRepository implements CalendarRepository {
  async listEvents(range?: CalendarRange): Promise<CalEvent[]> {
    await delay(200);
    const tenantLeads = new Set(
      mockState.leads.filter((l) => l.tenantId === mockState.currentTenantId).map((l) => l.id),
    );
    return mockState.events
      .filter((e) => tenantLeads.has(e.leadId))
      .filter((e) => !range?.from || e.at >= range.from)
      .filter((e) => !range?.to || e.at < range.to)
      .filter((e) => !range?.leadId || e.leadId === range.leadId)
      .sort((a, b) => a.at.localeCompare(b.at));
  }

  async create(input: CreateCalEventInput): Promise<CalEvent> {
    await delay(200);
    const lead = mockState.leads.find((l) => l.id === input.leadId);
    if (!lead) throw new Error(`Lead ${input.leadId} não encontrado.`);
    const event: CalEvent = {
      id: nextEventId(),
      leadId: lead.id,
      leadName: lead.name,
      title: input.title,
      type: input.type,
      at: input.at,
      time: shortTimeLabel(input.at),
    };
    mockState.events.push(event);
    return event;
  }

  async update(eventId: string, input: UpdateCalEventInput): Promise<CalEvent> {
    await delay(150);
    const event = mockState.events.find((e) => e.id === eventId);
    if (!event) throw new Error(`Compromisso ${eventId} não encontrado.`);
    if (input.title !== undefined) event.title = input.title;
    if (input.type !== undefined) event.type = input.type;
    if (input.at !== undefined) {
      event.at = input.at;
      event.time = shortTimeLabel(input.at);
    }
    return event;
  }

  async delete(eventId: string): Promise<void> {
    await delay(150);
    mockState.events = mockState.events.filter((e) => e.id !== eventId);
  }
}
