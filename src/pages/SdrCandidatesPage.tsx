import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SdrSubNav } from "../components/sdr/SdrSubNav";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ROUTES } from "../constants/routes";
import { useSdrCandidateActions } from "../hooks/useSdrCandidateActions";
import { useSdrCandidates } from "../hooks/useSdrCandidates";
import { useSdrDiscardReasons } from "../hooks/useSdrDiscardReasons";
import { useToast } from "../hooks/useToast";
import { SDR_CANDIDATE_STATUS_LABEL, type SdrCandidateStatus } from "../types/sdr";
import styles from "./SdrPages.module.css";

const STATUS_COLOR: Record<SdrCandidateStatus, { color: string; bg: string }> = {
  novo: { color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
  em_revisao: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  aprovado: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  descartado: { color: "var(--muted)", bg: "var(--card-bg-alt)" },
};

export function SdrCandidatesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<SdrCandidateStatus | "">("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkReason, setBulkReason] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  const { data, loading, error, notImplemented, reload } = useSdrCandidates({
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
    page: 1,
    pageSize: 100,
  });
  const { data: discardReasons } = useSdrDiscardReasons();
  const { bulk } = useSdrCandidateActions();

  const candidates = data?.items ?? [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: "review" | "approve" | "discard") {
    if (selected.size === 0) return;
    if (action === "discard" && !bulkReason) {
      toast("Escolha um motivo de descarte pra ação em lote");
      return;
    }
    setBulkRunning(true);
    try {
      const summary = await bulk({
        action,
        candidateIds: [...selected],
        ...(action === "discard" ? { discardReasonId: bulkReason } : {}),
      });
      toast(`${summary.ok} de ${summary.total} processados com sucesso`);
      setSelected(new Set());
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível executar a ação em lote");
    } finally {
      setBulkRunning(false);
    }
  }

  if (notImplemented) {
    return (
      <div>
        <SdrSubNav />
        <EmptyState
          title="Não disponível no modo Demonstração"
          message="SDR é uma área interna da GSM Automação, sem dados fictícios para mostrar aqui."
        />
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Candidates</h1>
          <p className={styles.pageSubtitle}>
            {data ? `${data.total} candidates` : "Carregando…"} — triagem humana
            (revisar/aprovar/descartar). Lista vazia até um futuro worker de busca existir.
          </p>
        </div>
      </div>

      <SdrSubNav />

      <div className={styles.filterRow}>
        <input
          className={styles.search}
          placeholder="Buscar por nome da empresa ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value as SdrCandidateStatus | "")}
        >
          <option value="">Todos os status</option>
          {(Object.entries(SDR_CANDIDATE_STATUS_LABEL) as [SdrCandidateStatus, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      {selected.size > 0 && (
        <div className={styles.filterRow}>
          <span className={styles.pageSubtitle}>{selected.size} selecionado(s):</span>
          <Button onClick={() => void runBulk("review")} disabled={bulkRunning}>
            Marcar em revisão
          </Button>
          <Button onClick={() => void runBulk("approve")} disabled={bulkRunning}>
            Aprovar
          </Button>
          <select
            className={styles.select}
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
          >
            <option value="">Motivo de descarte…</option>
            {(discardReasons ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Button onClick={() => void runBulk("discard")} disabled={bulkRunning || !bulkReason}>
            Descartar
          </Button>
        </div>
      )}

      {error && <EmptyState title="Não foi possível carregar os candidates" message={error.message} />}

      {!error && !loading && candidates.length === 0 && (
        <EmptyState
          title="Nenhum candidate ainda"
          message="Candidates chegam aqui quando uma campanha de busca (futuro worker, fora desta etapa) encontrar empresas. Até lá, esta lista fica vazia."
        />
      )}

      {!error && candidates.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCell}></th>
                <th>Empresa</th>
                <th>Nicho</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className={styles.row}>
                  <td className={styles.checkboxCell} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                  </td>
                  <td onClick={() => navigate(ROUTES.sdrCandidateDetail(c.id))}>{c.companyName}</td>
                  <td onClick={() => navigate(ROUTES.sdrCandidateDetail(c.id))}>{c.niche ?? "—"}</td>
                  <td onClick={() => navigate(ROUTES.sdrCandidateDetail(c.id))}>
                    <Badge label={SDR_CANDIDATE_STATUS_LABEL[c.status]} {...STATUS_COLOR[c.status]} />
                    {(c.knownDuplicateProspectId ?? c.knownDuplicateClientId) && (
                      <span style={{ marginLeft: 6 }}>
                        <Badge label="Já conhecido" color="var(--tone-red)" bg="var(--tone-red-bg)" />
                      </span>
                    )}
                  </td>
                  <td
                    className={styles.chevron}
                    onClick={() => navigate(ROUTES.sdrCandidateDetail(c.id))}
                  >
                    ›
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
