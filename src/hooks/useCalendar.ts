import { calendarService } from "../services/CalendarService";
import type { CalEvent, CalendarRange } from "../types/event";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useCalendar(range?: CalendarRange): AsyncResourceState<CalEvent[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(
    () => calendarService.listEvents(range),
    [JSON.stringify(range ?? {}), currentTenantId],
  );
}
