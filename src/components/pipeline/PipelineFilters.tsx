import { useId, useState } from "react";
import { BOARD_SORT_OPTIONS, type BoardSortOption } from "../../utils/boardSort";
import type { Period } from "../../utils/periods";
import { filterChips } from "../../utils/pipelineView";
import { FilterChip } from "../common/FilterChip";
import { IconChevronDown, IconFilter, IconSearch } from "../common/Icons";
import { PeriodFilter } from "../common/PeriodFilter";
import styles from "./PipelineFilters.module.css";

export interface OwnerOption {
  id: string;
  name: string;
}

/**
 * Filtros do Pipeline (Prompt 06). Prioridade visual: busca, responsável, ordenação. O período
 * (sempre sobre a data de CRIAÇÃO do lead — decisão D-02 mantida) fica em "Filtros" (progressive
 * disclosure) e, ativo, aparece como chip removível. Semântica e parâmetros enviados ao servidor
 * são os mesmos de antes; só a apresentação mudou.
 */
export function PipelineFilters({
  search,
  onSearch,
  owner,
  onOwner,
  owners,
  canFilterByOwner,
  sort,
  onSort,
  period,
  onPeriod,
}: {
  search: string;
  onSearch: (value: string) => void;
  owner: string;
  onOwner: (value: string) => void;
  owners: OwnerOption[] | undefined;
  canFilterByOwner: boolean;
  sort: BoardSortOption;
  onSort: (value: BoardSortOption) => void;
  period: Period;
  onPeriod: (value: Period) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ownerLabel =
    owner === "__none__" ? "Sem responsável" : owner ? (owners?.find((o) => o.id === owner)?.name ?? "—") : null;
  const sortLabel = sort === "none" ? null : (BOARD_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? null);
  const chips = filterChips({ search: search.trim(), ownerLabel, period, sortLabel });
  const periodActive = chips.some((c) => c.key === "period");

  const remove = (key: (typeof chips)[number]["key"]) => {
    if (key === "search") onSearch("");
    else if (key === "owner") onOwner("");
    else if (key === "period") onPeriod({});
    else onSort("none");
  };

  return (
    <section className={styles.filters} aria-label="Filtros do pipeline">
      <div className={styles.row}>
        <label className={styles.search}>
          <IconSearch size={16} />
          <input
            className={styles.searchInput}
            placeholder="Buscar lead…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Buscar lead"
          />
        </label>
        {canFilterByOwner && (
          <select
            className={styles.select}
            value={owner}
            onChange={(e) => onOwner(e.target.value)}
            aria-label="Responsável"
          >
            <option value="">Todos os responsáveis</option>
            <option value="__none__">Sem responsável</option>
            {owners?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <select
          className={styles.select}
          value={sort}
          onChange={(e) => onSort(e.target.value as BoardSortOption)}
          aria-label="Ordenação"
        >
          {BOARD_SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={open || periodActive ? `${styles.toggle} ${styles.toggleOn}` : styles.toggle}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <IconFilter size={16} />
          Filtros
          {periodActive && <span className={styles.dot} aria-label="1 filtro ativo" role="img" />}
          <IconChevronDown size={14} className={open ? styles.chevOpen : undefined} />
        </button>
      </div>

      <div id={panelId} className={styles.panel} hidden={!open}>
        <span className={styles.panelLabel} id={`${panelId}-label`}>
          Criados em
        </span>
        <PeriodFilter value={period} onChange={onPeriod} />
      </div>

      {chips.length > 0 && (
        <div className={styles.chips} role="group" aria-label="Filtros ativos">
          {chips.map((chip) => (
            <FilterChip key={chip.key} group={chip.group} value={chip.value} onRemove={() => remove(chip.key)} />
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              className={styles.clearAll}
              onClick={() => {
                onSearch("");
                onOwner("");
                onPeriod({});
                onSort("none");
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </section>
  );
}
