/** Ordenação client-side dos cards dentro de cada coluna do Kanban (Pipeline
 * de leads e Prospecção) — pedido explícito do usuário ("A-Z, Z-A, Data e
 * etc"). Deliberadamente client-side, não uma troca de `sortBy`/`sortDir` no
 * fetch: os boards já carregam a página inteira (200 itens) e reagrupam por
 * estágio no front, então reordenar aqui é instantâneo e não pede um
 * round-trip novo pra API a cada troca de critério. */
export type BoardSortOption = "none" | "az" | "za" | "date_desc" | "date_asc";

export const BOARD_SORT_OPTIONS: { value: BoardSortOption; label: string }[] = [
  { value: "none", label: "Ordenar: padrão" },
  { value: "az", label: "Nome A-Z" },
  { value: "za", label: "Nome Z-A" },
  { value: "date_desc", label: "Mais recentes primeiro" },
  { value: "date_asc", label: "Mais antigos primeiro" },
];

export function sortBoardItems<T>(
  items: T[],
  option: BoardSortOption,
  getName: (item: T) => string,
  getDate: (item: T) => string,
): T[] {
  if (option === "none") return items;
  const sorted = [...items];
  switch (option) {
    case "az":
      sorted.sort((a, b) => getName(a).localeCompare(getName(b), "pt-BR"));
      break;
    case "za":
      sorted.sort((a, b) => getName(b).localeCompare(getName(a), "pt-BR"));
      break;
    case "date_desc":
      // Datas ISO (`YYYY-MM-DD...`) comparam certo como string — sem
      // `Date` de propósito, mesmo racional de `isOverdue` em
      // `ProspectionBoard.tsx` (evita fuso mexer com "hoje").
      sorted.sort((a, b) => getDate(b).localeCompare(getDate(a)));
      break;
    case "date_asc":
      sorted.sort((a, b) => getDate(a).localeCompare(getDate(b)));
      break;
  }
  return sorted;
}
