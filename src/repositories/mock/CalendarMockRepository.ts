import type { CalendarRepository } from "../CalendarRepository";
import type { CalEvent, CreateCalEventInput } from "../../types/event";
import { delay } from "../../utils/errors";
import { shortTimeLabel } from "../../utils/dates";
import { mockState, nextEventId } from "./state";

export class CalendarMockRepository implements CalendarRepository {
  async listEvents(): Promise<CalEvent[]> {
    await delay(200);
    const out: CalEvent[] = [];
    for (const lead of mockState.leads.filter((l) => l.tenantId === mockState.currentTenantId)) {
      for (const e of lead.events) {
        out.push({ id: e.id, leadId: lead.id, leadName: lead.name, title: e.title, type: e.type, at: e.at, time: e.time });
      }
    }
    return out;
  }

  async create(input: CreateCalEventInput): Promise<CalEvent> {
    await delay(200);
    const lead = mockState.leads.find((l) => l.id === input.leadId);
    if (!lead) throw new Error(`Lead ${input.leadId} não encontrado.`);
    const event = {
      id: nextEventId(),
      title: input.title,
      type: input.type,
      at: input.at,
      time: shortTimeLabel(input.at),
    };
    lead.events.push(event);
    return { id: event.id, leadId: lead.id, leadName: lead.name, title: event.title, type: event.type, at: event.at, time: event.time };
  }

  async delete(eventId: string): Promise<void> {
    await delay(150);
    for (const lead of mockState.leads) {
      const index = lead.events.findIndex((e) => e.id === eventId);
      if (index >= 0) {
        lead.events.splice(index, 1);
        return;
      }
    }
  }
}
