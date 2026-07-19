import type { CalEvent } from "../types/event";
import { mockLeads } from "./leads";

export function buildMockEvents(): CalEvent[] {
  const out: CalEvent[] = [];
  for (const lead of mockLeads) {
    for (const e of lead.events) {
      out.push({
        id: e.id,
        leadId: lead.id,
        leadName: lead.name,
        title: e.title,
        type: e.type,
        at: e.at,
        time: e.time,
      });
    }
  }
  return out;
}
