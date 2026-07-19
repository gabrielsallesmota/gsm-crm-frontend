import { calendarService } from "../services/CalendarService";
import type { CalEvent } from "../types/event";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useCalendar(): AsyncResourceState<CalEvent[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => calendarService.listEvents(), [currentTenantId]);
}
