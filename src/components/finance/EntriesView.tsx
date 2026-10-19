import { useEffect, useMemo, useState } from "react";
import type {
  EntryFilter,
  EntryKind,
  EntryStatus,
  FinAccount,
  FinCategory,
  FinEntry,
  FinScope,
} from "../../types/finance";
import { KIND_LABEL, SCOPE_SHORT, STATUS_LABEL } from "../../types/finance";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { EmptyState } from "../common/EmptyState";
import { EntryFormModal } from "./EntryFormModal";
import { useFinanceEntries } from "../../hooks/useFinance";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { formatCents } from "../../utils/finance";
import { fmtDate } from "../../utils/renewal";
import form from "../common/Form.module.css";
import styles from "./Finance.module.css";

const PAGE_SIZE = 50;

const STATUS_TONE: Record<EntryStatus, { color: string; bg: string }> = {
  paid: { color: "var(--tone-green-text)", bg: "var(--tone-green-bg)" },
  pending: { color: "var(--tone-amber-text)", bg: "var(--tone-amber-bg)" },
  overdue: { color: "var(--tone-red-text)", bg: "var(--tone-red-bg)" },
};

/** Lançamentos: filtros, baixa/estorno, edição, exclusão (com a série) e exportação em CSV. */
export function EntriesView({
  categories,
  accounts,
  scope,
  month,
  refreshToken,
  onChanged,
}: {
  categories: FinCategory[];
  accounts: FinAccount[];
  scope: FinScope | undefined;
  /** Mês escolhido no painel ("YYYY-MM"); a lista começa filtrada por ele. */
  month: string;
  /** Muda quando um lançamento é criado fora desta aba: recarrega a lista. */
  refreshToken: number;
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const [kind, setKind] = useState<EntryKind | "">("");
  const [status, setStatus] = useState<EntryStatus | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [allMonths, setAllMonths] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<FinEntry | null>(null);
  const [deleting, setDeleting] = useState<FinEntry | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const debounced = useDebouncedValue(search, 300);

  const range = useMemo(() => monthRange(month), [month]);
  const filter: EntryFilter = {
    ...(scope ? { scope } : {}),
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(allMonths ? {} : { dateFrom: range.from, dateTo: range.to }),
    ...(debounced.trim() ? { search: debounced.trim() } : {}),
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, loading, error, reload } = useFinanceEntries(filter);
  useEffect(() => {
    if (refreshToken > 0) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);
  const items = data?.items ?? [];
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function changed() {
    reload();
    onChanged();
  }

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  async function togglePaid(entry: FinEntry) {
    try {
      if (entry.paidAt) await financeService.unpayEntry(entry.id);
      else await financeService.payEntry(entry.id);
      changed();
    } catch (err) {
      toastError(err, "Não foi possível atualizar a baixa");
    }
  }

  async function confirmDelete(series: boolean) {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      const count = await financeService.deleteEntry(deleting.id, series);
      toast(count > 1 ? `${count} lançamentos removidos` : "Lançamento removido");
      setDeleting(null);
      changed();
    } catch (err) {
      toastError(err, "Não foi possível remover o lançamento");
    } finally {
      setBusyDelete(false);
    }
  }

  async function exportCsv() {
    try {
      const blob = await financeService.exportCsv({
        ...(scope ? { scope } : {}),
        ...(kind ? { kind } : {}),
        ...(allMonths ? {} : { dateFrom: range.from, dateTo: range.to }),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "financeiro.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err, "Não foi possível exportar");
    }
  }

  return (
    <div>
      <div className={styles.filters} role="search" aria-label="Filtrar lançamentos">
        <label className={styles.filterField}>
          Buscar
          <input className={styles.control} value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Descrição ou observação" />
        </label>
        <label className={styles.filterField}>
          Tipo
          <select className={styles.control} value={kind} onChange={(e) => reset(setKind)(e.target.value as EntryKind | "")}>
            <option value="">Todos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </select>
        </label>
        <label className={styles.filterField}>
          Situação
          <select className={styles.control} value={status} onChange={(e) => reset(setStatus)(e.target.value as EntryStatus | "")}>
            <option value="">Todas</option>
            <option value="paid">Pagas / recebidas</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Atrasadas</option>
          </select>
        </label>
        <label className={styles.filterField}>
          Categoria
          <select className={styles.control} value={categoryId} onChange={(e) => reset(setCategoryId)(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          Período
          <select className={styles.control} value={allMonths ? "all" : "month"} onChange={(e) => reset(setAllMonths)(e.target.value === "all")}>
            <option value="month">Mês do painel</option>
            <option value="all">Tudo</option>
          </select>
        </label>
        <Button onClick={() => void exportCsv()}>Exportar CSV</Button>
      </div>

      {error && <EmptyState title="Não foi possível carregar os lançamentos" message={error.message} />}

      {!error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>PF/PJ</th>
                <th>Situação</th>
                <th className={styles.num}>Valor</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td>
                    {fmtDate(e.entryDate)}
                    {e.dueDate && e.dueDate !== e.entryDate && (
                      <div className={styles.listMeta}>vence {fmtDate(e.dueDate)}</div>
                    )}
                  </td>
                  <td>
                    {e.description}
                    <div className={styles.listMeta}>
                      {e.accountId ? accountNames.get(e.accountId) : ""}
                      {e.installmentNo ? ` · ${e.installmentNo}/${e.installmentTotal}` : ""}
                    </div>
                  </td>
                  <td>{e.categoryId ? (names.get(e.categoryId) ?? "—") : "—"}</td>
                  <td>{SCOPE_SHORT[e.scope]}</td>
                  <td>
                    <Badge label={STATUS_LABEL[e.status]} color={STATUS_TONE[e.status].color} bg={STATUS_TONE[e.status].bg} />
                  </td>
                  <td className={styles.num}>
                    <strong className={e.kind === "income" ? styles.positive : styles.negative}>
                      {e.kind === "income" ? "+" : "-"}
                      {formatCents(e.amountCents)}
                    </strong>
                    <div className={styles.listMeta}>{KIND_LABEL[e.kind]}</div>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Button onClick={() => void togglePaid(e)}>
                        {e.paidAt ? "Estornar" : e.kind === "income" ? "Receber" : "Pagar"}
                      </Button>
                      <Button onClick={() => setEditing(e)} aria-label={`Editar ${e.description}`}>Editar</Button>
                      <Button variant="danger" onClick={() => setDeleting(e)} aria-label={`Excluir ${e.description}`}>
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && items.length === 0 && (
            <p className={styles.empty} style={{ padding: 16 }}>
              Nenhum lançamento com esses filtros.
            </p>
          )}
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className={styles.toolbar} style={{ marginTop: 12 }}>
          <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button>
          <span className={styles.muted}>Página {page} de {pages} · {data.total} lançamentos</span>
          <Button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>Próxima</Button>
        </div>
      )}

      {editing && (
        <EntryFormModal
          entry={editing}
          categories={categories}
          accounts={accounts}
          defaults={scope ? { scope } : {}}
          onClose={() => setEditing(null)}
          onSaved={changed}
        />
      )}

      {deleting && (
        <Modal title="Excluir lançamento?" onClose={() => (busyDelete ? undefined : setDeleting(null))}>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.5 }}>
            {deleting.recurrenceId
              ? `"${deleting.description}" faz parte de uma série mensal. Você pode excluir só este lançamento ou este e os próximos que ainda não foram pagos.`
              : `"${deleting.description}" será excluído. Esta ação não pode ser desfeita.`}
          </p>
          <div className={form.actions}>
            <Button onClick={() => setDeleting(null)} disabled={busyDelete}>Cancelar</Button>
            <Button variant="danger" onClick={() => void confirmDelete(false)} disabled={busyDelete}>
              {deleting.recurrenceId ? "Só este" : "Excluir"}
            </Button>
            {deleting.recurrenceId && (
              <Button variant="danger" onClick={() => void confirmDelete(true)} disabled={busyDelete}>
                Este e os próximos
              </Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y ?? 1970, m ?? 1, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}
