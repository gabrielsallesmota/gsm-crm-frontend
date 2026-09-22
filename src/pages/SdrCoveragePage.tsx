import { useState } from "react";
import { SdrSubNav } from "../components/sdr/SdrSubNav";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { useSdrCoverage } from "../hooks/useSdrCoverage";
import { useSdrCoverageActions } from "../hooks/useSdrCoverageActions";
import { useToast } from "../hooks/useToast";
import { SDR_COVERAGE_STATUS_LABEL, type SdrCoverageStatus } from "../types/sdr";
import styles from "./SdrPages.module.css";

const STATUS_COLOR: Record<SdrCoverageStatus, { color: string; bg: string }> = {
  nao_iniciada: { color: "var(--muted)", bg: "var(--card-bg-alt)" },
  em_andamento: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  concluida: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  falhou: { color: "var(--tone-red)", bg: "var(--tone-red-bg)" },
};

export function SdrCoveragePage() {
  const { data: coverage, loading, error, notImplemented, reload } = useSdrCoverage();
  const { create, delete: deleteCoverage } = useSdrCoverageActions();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteCoverage(id);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível excluir");
    } finally {
      setDeletingId(null);
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
          <h1 className={styles.pageTitle}>Cobertura de busca</h1>
          <p className={styles.pageSubtitle}>
            Registro/planejamento de nicho × localidade × provider — nenhuma busca real é
            disparada nesta etapa, é só o mapa do que já foi/será coberto.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Registrar cobertura
        </Button>
      </div>

      <SdrSubNav />

      {error && <EmptyState title="Não foi possível carregar a cobertura" message={error.message} />}

      {!error && !loading && coverage && coverage.length === 0 && (
        <EmptyState
          title="Nenhuma cobertura registrada ainda"
          message='Clique em "Registrar cobertura" pra planejar o primeiro nicho × localidade × provider.'
        />
      )}

      {!error && coverage && coverage.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nicho</th>
                <th>Localidade</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Processados</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((c) => (
                <tr key={c.id}>
                  <td>{c.niche}</td>
                  <td>{[c.city, c.state, c.country].filter(Boolean).join(", ") || "—"}</td>
                  <td>{c.provider}</td>
                  <td>
                    <Badge label={SDR_COVERAGE_STATUS_LABEL[c.status]} {...STATUS_COLOR[c.status]} />
                  </td>
                  <td>{c.quantityProcessed}</td>
                  <td className={styles.chevron}>
                    <button
                      className={styles.smallRemoveBtn}
                      type="button"
                      onClick={() => void handleDelete(c.id)}
                      disabled={deletingId === c.id}
                    >
                      {deletingId === c.id ? "Excluindo…" : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateCoverageModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
          onCreateFn={create}
        />
      )}
    </div>
  );
}

function CreateCoverageModal({
  onClose,
  onCreated,
  onCreateFn,
}: {
  onClose: () => void;
  onCreated: () => void;
  onCreateFn: ReturnType<typeof useSdrCoverageActions>["create"];
}) {
  const { toast } = useToast();
  const [niche, setNiche] = useState("");
  const [provider, setProvider] = useState("manual");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!niche.trim() || !provider.trim() || (!state.trim() && !city.trim())) return;
    setSubmitting(true);
    try {
      await onCreateFn({ niche: niche.trim(), provider: provider.trim(), state, city });
      toast("Cobertura registrada");
      onCreated();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível registrar a cobertura");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Registrar cobertura</h2>
        <p className={styles.modalSubtitle}>
          Planejamento — não dispara nenhuma busca real nesta etapa.
        </p>
        <label className={styles.fieldLabel}>
          Nicho
          <input className={styles.input} value={niche} onChange={(e) => setNiche(e.target.value)} />
        </label>
        <label className={styles.fieldLabel}>
          Provider
          <input
            className={styles.input}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          />
        </label>
        <label className={styles.fieldLabel}>
          Estado
          <input className={styles.input} value={state} onChange={(e) => setState(e.target.value)} />
        </label>
        <label className={styles.fieldLabel}>
          Cidade
          <input className={styles.input} value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <div className={styles.modalActions}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || !niche.trim() || !provider.trim() || (!state.trim() && !city.trim())}
          >
            {submitting ? "Registrando…" : "Registrar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
