export interface Period {
  dateFrom?: string;
  dateTo?: string;
}

/** `YYYY-MM-DD` no fuso local — não usar `toISOString()` aqui (é UTC e pode
 * "virar" um dia a menos/mais dependendo do horário/fuso de quem está
 * usando o filtro). */
function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayPeriod(): Period {
  const today = toISODate(new Date());
  return { dateFrom: today, dateTo: today };
}

export function last7DaysPeriod(): Period {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { dateFrom: toISODate(from), dateTo: toISODate(to) };
}

export function thisMonthPeriod(): Period {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: toISODate(from), dateTo: toISODate(now) };
}

export function lastMonthPeriod(): Period {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { dateFrom: toISODate(from), dateTo: toISODate(to) };
}

export const EMPTY_PERIOD: Period = {};
