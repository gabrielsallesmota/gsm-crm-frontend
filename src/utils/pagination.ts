/** Paginação da lista (Etapa 1) — sempre pelo `total` REAL do backend,
 * nunca por "o que coube numa busca de 100/200". Testado em
 * `tests/pagination.test.ts`. */
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Página válida depois de uma mudança (ex.: excluí o último item da última
 * página → volta uma). */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

/** "26–50 de 132" */
export function rangeLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return "0 de 0";
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return `${from}–${to} de ${total}`;
}
