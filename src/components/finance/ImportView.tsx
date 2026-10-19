import { useEffect, useId, useState } from "react";
import type {
  FinAccount,
  FinCategory,
  FinProfile,
  ImportHistoryItem,
  ImportPreview,
  ImportRow,
} from "../../types/finance";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { formatCents } from "../../utils/finance";
import { fmtDate } from "../../utils/renewal";
import styles from "./Finance.module.css";

const MAX_BYTES = 2_000_000;

const STATUS: Record<ImportRow["status"], { label: string; color: string; bg: string }> = {
  new: { label: "Nova", color: "var(--tone-green-text)", bg: "var(--tone-green-bg)" },
  duplicate: { label: "Já existe", color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
  match: { label: "Parece um lançamento seu", color: "var(--tone-amber-text)", bg: "var(--tone-amber-bg)" },
  error: { label: "Erro", color: "var(--tone-red-text)", bg: "var(--tone-red-bg)" },
};

/** Lê o arquivo no navegador e devolve o conteúdo em base64 (nada é guardado no servidor). */
async function readFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Importar extrato (CSV, OFX, QFX): escolhe a conta, vê a prévia — NADA é gravado até confirmar —,
 * decide as linhas parecidas com lançamentos manuais (vincular em vez de duplicar) e confirma. O
 * histórico permite desfazer uma importação.
 */
export function ImportView({
  accounts,
  categories,
  profiles,
  profileId,
  onChanged,
}: {
  accounts: FinAccount[];
  categories: FinCategory[];
  profiles: FinProfile[];
  profileId: string | undefined;
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const eligible = accounts.filter(
    (a) => a.kind !== "cartao" && !a.archived && (!profileId || a.profileId === profileId),
  );
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<{ name: string; contentBase64: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [decisions, setDecisions] = useState<Record<number, string>>({});
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [undoing, setUndoing] = useState<ImportHistoryItem | null>(null);
  const account = eligible.find((a) => a.id === accountId) ?? eligible[0];
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const usable = categories.filter((c) => !c.archived && c.profileId === account?.profileId);

  function loadHistory() {
    void financeService
      .listImports()
      .then(setHistory)
      .catch((err) => toastError(err, "Não foi possível carregar o histórico"));
  }
  useEffect(loadHistory, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function choose(selected: File | undefined) {
    setPreview(null);
    setDecisions({});
    setFile(null);
    if (!selected) return;
    if (selected.size > MAX_BYTES) {
      toastError(new Error("Arquivo grande demais (máximo 2 MB)"), "Arquivo recusado");
      return;
    }
    setFile({ name: selected.name, contentBase64: await readFile(selected) });
  }

  async function read() {
    if (!account || !file) return;
    setBusy(true);
    try {
      const result = await financeService.previewImport(account.id, file);
      setPreview(result);
      setDecisions(
        Object.fromEntries(result.rows.map((r) => [r.line, r.defaultDecision] as [number, string])),
      );
    } catch (err) {
      setPreview(null);
      toastError(err, "Não foi possível ler o arquivo");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!account || !file || !preview) return;
    setBusy(true);
    try {
      const result = await financeService.commitImport(account.id, file, {
        decisions,
        ...(categoryId ? { defaultCategoryId: categoryId } : {}),
      });
      toast(
        `${result.rowsImported} importadas · ${result.rowsLinked} vinculadas · ${result.rowsSkipped} ignoradas`,
      );
      setPreview(null);
      setFile(null);
      setDecisions({});
      loadHistory();
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível importar");
    } finally {
      setBusy(false);
    }
  }

  async function undo(): Promise<boolean> {
    if (!undoing) return false;
    try {
      const result = await financeService.undoImport(undoing.id);
      toast(`Importação desfeita: ${result.removed} removidas, ${result.restored} restauradas`);
      loadHistory();
      onChanged();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível desfazer");
      return false;
    }
  }

  const willImport = preview
    ? preview.rows.filter((r) => decisions[r.line] === "import").length
    : 0;
  const willLink = preview
    ? preview.rows.filter((r) => decisions[r.line]?.startsWith("link:")).length
    : 0;

  return (
    <div>
      <section className={styles.card} aria-labelledby={`${uid}-import`}>
        <h3 id={`${uid}-import`} className={styles.cardTitle}>Importar extrato</h3>
        <p className={styles.budgetNote}>
          Aceita CSV, OFX e QFX de contas (cartão não: lance as compras na fatura). Nada é gravado até você
          confirmar e o arquivo não fica guardado — só o nome, o resumo e o histórico.
        </p>
        <div className={styles.inlineForm}>
          <label className={styles.filterField}>
            Conta
            <select className={styles.control} value={account?.id ?? ""} onChange={(e) => { setAccountId(e.target.value); setPreview(null); }}>
              {eligible.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({names.get(a.profileId) ?? "—"})</option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            Arquivo
            <input
              className={styles.control}
              type="file"
              accept=".csv,.ofx,.qfx,.txt"
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </label>
          <Button variant="primary" onClick={() => void read()} disabled={busy || !account || !file}>
            Ler arquivo
          </Button>
        </div>
        {eligible.length === 0 && <p className={styles.empty}>Cadastre uma conta antes de importar.</p>}

        {preview && (
          <div className={styles.sectionGap}>
            <p role="status">
              <strong>{preview.total} linhas</strong>: {preview.new} novas · {preview.match} parecidas com lançamentos
              seus · {preview.duplicate} já existentes · {preview.error} com erro. Entradas{" "}
              {formatCents(preview.incomeCents)} · saídas {formatCents(preview.expenseCents)}.
            </p>
            {preview.alreadyImportedAt && (
              <p className={styles.budgetOver} role="alert">
                Este arquivo já foi importado nesta conta em {fmtDate(preview.alreadyImportedAt.slice(0, 10))}. As
                linhas repetidas serão ignoradas.
              </p>
            )}
            {preview.warnings.map((w) => (
              <p key={w} className={styles.budgetWarn}>{w}</p>
            ))}
            {preview.ledgerBalanceCents !== null && (
              <p className={styles.listMeta}>
                Saldo informado no arquivo: {formatCents(preview.ledgerBalanceCents)}
                {preview.ledgerDate ? ` em ${fmtDate(preview.ledgerDate)}` : ""}.
              </p>
            )}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="sr-only">Linhas do extrato</caption>
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Situação</th>
                    <th className={styles.num}>Valor</th>
                    <th>O que fazer</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line}>
                      <td>{r.line}</td>
                      <td>{r.posted ? fmtDate(r.posted) : "—"}</td>
                      <td>
                        {r.description || "—"}
                        {r.error && <div className={styles.listMeta}>{r.error}</div>}
                      </td>
                      <td><Badge label={STATUS[r.status].label} color={STATUS[r.status].color} bg={STATUS[r.status].bg} /></td>
                      <td className={styles.num}>
                        {r.amountCents === null ? "—" : formatCents(r.amountCents)}
                      </td>
                      <td>
                        {r.status === "new" && (
                          <select
                            aria-label={`Linha ${r.line}`}
                            className={styles.control}
                            value={decisions[r.line]}
                            onChange={(e) => setDecisions({ ...decisions, [r.line]: e.target.value })}
                          >
                            <option value="import">Importar</option>
                            <option value="skip">Ignorar</option>
                          </select>
                        )}
                        {r.status === "match" && r.match && (
                          <select
                            aria-label={`Linha ${r.line}`}
                            className={styles.control}
                            value={decisions[r.line]}
                            onChange={(e) => setDecisions({ ...decisions, [r.line]: e.target.value })}
                          >
                            <option value="skip">Ignorar</option>
                            <option value={`link:${r.match.entryId}`}>
                              Vincular a “{r.match.description}” ({fmtDate(r.match.entryDate)})
                            </option>
                            <option value="import">Importar mesmo assim</option>
                          </select>
                        )}
                        {(r.status === "duplicate" || r.status === "error") && <span className={styles.listMeta}>Ignorada</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.inlineForm}>
              <label className={styles.filterField}>
                Categoria das linhas importadas (opcional)
                <select className={styles.control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sem categoria</option>
                  {usable.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <Button variant="primary" onClick={() => void confirm()} disabled={busy || (willImport === 0 && willLink === 0)}>
                Confirmar importação ({willImport} novas{willLink ? ` · ${willLink} vinculadas` : ""})
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className={`${styles.card} ${styles.sectionGap}`} aria-label="Histórico de importações">
        <h3 className={styles.cardTitle}>Histórico</h3>
        {history.length === 0 ? (
          <p className={styles.empty}>Nenhuma importação ainda.</p>
        ) : (
          <ul className={styles.list} aria-label="Importações">
            {history.map((i) => (
              <li key={i.id} className={styles.listItem}>
                <span className={styles.listMain}>
                  {i.fileName}{" "}
                  <span className={styles.listMeta}>
                    · {i.source.toUpperCase()} · {i.createdAt ? fmtDate(i.createdAt.slice(0, 10)) : ""} ·{" "}
                    {i.rowsImported} importadas, {i.rowsLinked} vinculadas, {i.rowsSkipped} ignoradas
                    {i.status === "undone" ? " · desfeita" : ""}
                  </span>
                </span>
                {i.status === "committed" && (
                  <Button onClick={() => setUndoing(i)} aria-label={`Desfazer importação ${i.fileName}`}>
                    Desfazer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {undoing && (
        <ConfirmDialog
          title="Desfazer a importação?"
          message={`Os lançamentos criados por “${undoing.fileName}” vão para a lixeira e os que você vinculou voltam ao que eram. Dá para importar o arquivo de novo depois.`}
          confirmLabel="Desfazer"
          onConfirm={undo}
          onClose={() => setUndoing(null)}
        />
      )}
    </div>
  );
}
