import type { CalendarRepository } from "../CalendarRepository";
import type { CalEvent } from "../../types/event";
import { delay } from "../../utils/errors";
import { mockState } from "./state";

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
}
