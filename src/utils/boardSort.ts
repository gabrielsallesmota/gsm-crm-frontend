/** Opções de ordenação dos cards dentro de cada coluna do Kanban.
 *
 * - Pipeline de LEADS (Fase 1B, PIP-02): a ordenação é GLOBAL e feita pelo SERVIDOR — a coluna só
 *   carrega 25 cards por vez, então ordenar só os já carregados mostrava uma ordem falsa. Use
 *   `serverSortFor` para traduzir a opção em `sortBy`/`sortDir` da listagem.
 * - Prospecção (`sortBoardItems`): segue client-side, sobre os itens que o quadro já carregou. */
export type BoardSortOption = "none" | "az" | "za" | "date_desc" | "date_asc";

export const BOARD_SORT_OPTIONS: { value: BoardSortOption; label: string }[] = [
  { value: "none", label: "Ordenar: padrão" },
  { value: "az", label: "Nome A-Z" },
  { value: "za", label: "Nome Z-A" },
  { value: "date_desc", label: "Mais recentes primeiro" },
  { value: "date_asc", label: "Mais antigos primeiro" },
];

/** Opção da tela → ordenação enviada ao servidor. "padrão" não envia nada (padrão do servidor:
 * mais recentes primeiro, desempate por id). */
export function serverSortFor(option: BoardSortOption): { sortBy?: string; sortDir?: "asc" | "desc" } {
  switch (option) {
    case "az":
      return { sortBy: "name", sortDir: "asc" };
    case "za":
      return { sortBy: "name", sortDir: "desc" };
    case "date_desc":
      return { sortBy: "created_at", sortDir: "desc" };
    case "date_asc":
      return { sortBy: "created_at", sortDir: "asc" };
    default:
      return {};
  }
}

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
