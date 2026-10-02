import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SdrSubNav } from "../components/sdr/SdrSubNav";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ROUTES } from "../constants/routes";
import { useSdrCandidateActions } from "../hooks/useSdrCandidateActions";
import { useSdrCampaigns } from "../hooks/useSdrCampaigns";
import { useSdrCandidates } from "../hooks/useSdrCandidates";
import { useSdrDiscardReasons } from "../hooks/useSdrDiscardReasons";
import { ManageDiscardReasonsModal } from "../components/sdr/ManageDiscardReasonsModal";
import { useToast } from "../hooks/useToast";
import { sdrService } from "../services/SdrService";
import {
  SDR_CANDIDATE_STATUS_LABEL,
  type SdrCandidateStatus,
  type SdrPriority,
} from "../types/sdr";
import styles from "./SdrPages.module.css";

const STATUS_COLOR: Record<SdrCandidateStatus, { color: string; bg: string }> = {
  novo: { color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
  em_revisao: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  aprovado: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  descartado: { color: "var(--muted)", bg: "var(--card-bg-alt)" },
};

const PRIORITY_COLOR: Record<SdrPriority, { color: string; bg: string }> = {
  a: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  b: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  c: { color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
};

const PAGE_SIZE = 50;

type YesNo = "" | "yes" | "no";

function yesNo(value: YesNo): boolean | undefined {
  if (value === "") return undefined;
  return value === "yes";
}

export function SdrCandidatesPage() {
  const navigate = useNavigate();
  const { toast, toastError } = useToast();
  const [status, setStatus] = useState<SdrCandidateStatus | "">("");
  const [search, setSearch] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [priority, setPriority] = useState<SdrPriority | "none" | "">("");
  const [hasPhone, setHasPhone] = useState<YesNo>("");
  const [hasSite, setHasSite] = useState<YesNo>("");
  const [order, setOrder] = useState<"recent" | "score">("score");
  const [page, setPage] = useState(1);
  const [scoring, setScoring] = useState(false);
  const { data: campaigns } = useSdrCampaigns();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkReason, setBulkReason] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  const phoneFilter = yesNo(hasPhone);
  const siteFilter = yesNo(hasSite);
  const { data, loading, error, notImplemented, reload } = useSdrCandidates({
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(priority ? { priority } : {}),
    ...(phoneFilter !== undefined ? { hasPhone: phoneFilter } : {}),
    ...(siteFilter !== undefined ? { hasSite: siteFilter } : {}),
    order,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  // Qualquer filtro novo volta para a 1ª página.
  function filterChanged<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
      setSelected(new Set());
    };
  }

  async function handleComputeCampaignScores() {
    if (!campaignId) return;
    setScoring(true);
    try {
      await sdrService.computeCampaignScores(campaignId);
      toast("Score da campanha em cálculo — atualize a lista em alguns segundos.", "info");
    } catch (err) {
      toastError(err, "Não foi possível calcular o Score da campanha");
    } finally {
      setScoring(false);
    }
  }
  const { data: discardReasons, reload: reloadDiscardReasons } = useSdrDiscardReasons();
  const [managingReasons, setManagingReasons] = useState(false);
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
      toast("Escolha um motivo de descarte pra ação em lote", "warning");
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
      toastError(err, "Não foi possível executar a ação em lote");
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
            {data ? `${data.total} candidates` : "Carregando…"} — o Score é calculado sozinho
            quando o garimpo encontra a empresa. Filtre os A e B e aprove em lote.
          </p>
        </div>
      </div>

      <SdrSubNav />

      <div className={styles.filterRow}>
        <input
          className={styles.search}
          placeholder="Buscar por nome da empresa ou telefone…"
          value={search}
          onChange={(e) => filterChanged(setSearch)(e.target.value)}
        />
        <select
          className={styles.select}
          value={campaignId}
          onChange={(e) => filterChanged(setCampaignId)(e.target.value)}
          aria-label="Campanha"
        >
          <option value="">Todas as campanhas</option>
          {(campaigns ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={priority}
          onChange={(e) => filterChanged(setPriority)(e.target.value as SdrPriority | "none" | "")}
          aria-label="Prioridade"
        >
          <option value="">Todas as prioridades</option>
          <option value="a">A — alta</option>
          <option value="b">B — média</option>
          <option value="c">C — baixa</option>
          <option value="none">Sem Score ainda</option>
        </select>
        <select
          className={styles.select}
          value={hasPhone}
          onChange={(e) => filterChanged(setHasPhone)(e.target.value as YesNo)}
          aria-label="Telefone"
        >
          <option value="">Com ou sem telefone</option>
          <option value="yes">Com telefone</option>
          <option value="no">Sem telefone</option>
        </select>
        <select
          className={styles.select}
          value={hasSite}
          onChange={(e) => filterChanged(setHasSite)(e.target.value as YesNo)}
          aria-label="Site"
        >
          <option value="">Com ou sem site</option>
          <option value="yes">Com site</option>
          <option value="no">Sem site</option>
        </select>
        <select
          className={styles.select}
          value={order}
          onChange={(e) => filterChanged(setOrder)(e.target.value as "recent" | "score")}
          aria-label="Ordem"
        >
          <option value="score">Maior Score primeiro</option>
          <option value="recent">Mais recentes primeiro</option>
        </select>
        {campaignId && (
          <Button
            onClick={() => void handleComputeCampaignScores()}
            disabled={scoring}
            title="Calcula (ou recalcula) o Score de todos os candidatos desta campanha. Sem custo de API."
          >
            {scoring ? "Enviando…" : "Calcular Score da campanha"}
          </Button>
        )}
        <select
          className={styles.select}
          value={status}
          onChange={(e) => filterChanged(setStatus)(e.target.value as SdrCandidateStatus | "")}
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
          <Button onClick={() => setManagingReasons(true)}>Motivos de descarte</Button>
        </div>
      )}

      {managingReasons && (
        <ManageDiscardReasonsModal
          reasons={discardReasons ?? []}
          onClose={() => setManagingReasons(false)}
          onChanged={reloadDiscardReasons}
        />
      )}

      {error && <EmptyState title="Não foi possível carregar os candidates" message={error.message} />}

      {!error && !loading && candidates.length === 0 && (
        <EmptyState
          title="Nenhum candidate com esses filtros"
          message="Candidates chegam aqui quando uma campanha de garimpo encontra empresas. Tente tirar algum filtro."
        />
      )}

      {!error && candidates.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCell}></th>
                <th>Empresa</th>
                <th>Score</th>
                <th>Contato</th>
                <th>Google</th>
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
                  <td onClick={() => navigate(ROUTES.sdrCandidateDetail(c.id))}>
                    {c.companyName}
                    {(c.locality ?? c.city) && (
                      <div className={styles.pageSubtitle} style={{ margin: 0 }}>
                        {[c.locality, c.city].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </td>
                  <td onClick={() => navigate(ROUTES.sdrCandidateDetail(c.id))}>
                    {c.scorePriority && c.scoreTotal !== null ? (
                      <Badge
                        label={`${c.scoreTotal} · ${c.scorePriority.toUpperCase()}`}
                        {...PRIORITY_COLOR[c.scorePriority]}
                      />
                    ) : (
                      <span className={styles.pageSubtitle}>—</span>
                    )}
                  </td>
                  <td onClick={() => navigate(ROUTES.sdrCandidateDetail(c.id))}>
                    <span title={c.phoneRaw ?? "Sem telefone"} style={{ opacity: c.phoneRaw ? 1 : 0.25 }}>
                      📞
                    </span>{" "}
                    <span title={c.domain ?? "Sem site"} style={{ opacity: c.domain ? 1 : 0.25 }}>
                      🌐
                    </span>
                  </td>
                  <td onClick={() => navigate(ROUTES.sdrCandidateDetail(c.id))}>
                    {c.googleRating !== null
                      ? `${c.googleRating.toFixed(1)}★ (${c.googleReviewsCount ?? 0})`
                      : "—"}
                  </td>
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

      {!error && data && data.total > PAGE_SIZE && (
        <div className={styles.filterRow} style={{ justifyContent: "center", marginTop: 12 }}>
          <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            ‹ Anterior
          </Button>
          <span className={styles.pageSubtitle}>
            Página {page} de {totalPages}
          </span>
          <Button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Próxima ›
          </Button>
        </div>
      )}
    </div>
  );
}
