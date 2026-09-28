/**
 * Datas/horas de tarefas e compromissos (Etapa 1). O backend RECUSA horário
 * sem fuso (422) — então todo valor enviado sai como ISO 8601 em UTC
 * (`...Z`), convertido a partir do horário LOCAL que a pessoa digitou no
 * `<input type="datetime-local">`. Exibição sempre no fuso do navegador.
 * Funções puras — testadas em `tests/datetime.test.ts`.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-09-27T14:30" (horário local digitado) → ISO UTC com `Z`.
 * `null` para valor vazio/inválido. */
export function localInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const date = new Date(value); // sem sufixo = horário LOCAL (spec ECMAScript)
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO (qualquer fuso) → valor para `<input type="datetime-local">` no fuso local. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Data local + hora local" separados (formulário da agenda) → ISO UTC. */
export function localDateTimeToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const hhmm = /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
  return localInputToIso(`${date}T${hhmm}`);
}

/** Valor padrão do campo de vencimento: amanhã às 09:00 locais. */
export function defaultDueInput(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  return isoToLocalInput(d.toISOString());
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isOverdue(iso: string, done: boolean, now: Date = new Date()): boolean {
  return !done && new Date(iso).getTime() < now.getTime();
}

/** Nome do fuso do navegador — exibido nos formulários ("horário de ..."). */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  } catch {
    return "local";
  }
}
