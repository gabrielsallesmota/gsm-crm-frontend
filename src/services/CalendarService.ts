import type { CalendarRepository } from "../repositories/CalendarRepository";
import { CalendarApiRepository } from "../repositories/api/CalendarApiRepository";
import { CalendarMockRepository } from "../repositories/mock/CalendarMockRepository";
import { selectRepository } from "./factory";

/** Repasse direto ao repositório do modo atual (API real ou demonstração)
 * — a interface `CalendarRepository` é o contrato. */
export const calendarService: CalendarRepository = selectRepository(
  () => new CalendarMockRepository(),
  () => new CalendarApiRepository(),
);
