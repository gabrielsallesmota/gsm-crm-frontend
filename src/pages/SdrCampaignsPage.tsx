import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SdrSubNav } from "../components/sdr/SdrSubNav";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { Modal } from "../components/common/Modal";
import { ROUTES } from "../constants/routes";
import { useSdrCampaigns } from "../hooks/useSdrCampaigns";
import { useSdrCampaignRunActions } from "../hooks/useSdrCampaignRunActions";
import { useToast } from "../hooks/useToast";
import { SDR_CAMPAIGN_STATUS_LABEL, SDR_RUN_MODE_LABEL, type SdrCampaignStatus, type SdrRunMode } from "../types/sdr";
import styles from "./SdrPages.module.css";

const RUN_MODES: SdrRunMode[] = ["reuse_known", "find_new", "full_refresh"];

const STATUS_COLOR: Record<SdrCampaignStatus, { color: string; bg: string }> = {
  draft: { color: "var(--muted)", bg: "var(--card-bg-alt)" },
  active: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  paused: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  archived: { color: "var(--muted)", bg: "var(--card-bg-alt)" },
};

export function SdrCampaignsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: campaigns, loading, error, notImplemented } = useSdrCampaigns();
  const { start } = useSdrCampaignRunActions();
  const [startingCampaignId, setStartingCampaignId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<SdrRunMode>("find_new");
  const [starting, setStarting] = useState(false);

  async function handleStartRun() {
    if (!startingCampaignId) return;
    setStarting(true);
    try {
      const run = await start(startingCampaignId, { mode: selectedMode });
      setStartingCampaignId(null);
      navigate(ROUTES.sdrCampanhaExecucao(startingCampaignId, run.id));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível iniciar o garimpo");
    } finally {
      setStarting(false);
    }
  }

  if (notImplemented) {
    return (
      <div>
        <SdrSubNav />
        <EmptyState
          title="Não disponível no modo Demonstração"
          message="SDR é uma área interna da GSM Automação, sem dados fictícios para mostrar aqui. Acesse com a conta real de platform staff para usar."
        />
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Campanhas de prospecção</h1>
          <p className={styles.pageSubtitle}>
            {campaigns ? `${campaigns.length} campanhas` : "Carregando…"} — configuração de busca
            (nicho, localidades, termos). Use "Iniciar garimpo" numa linha pra disparar uma busca
            real via Google Places.
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate(ROUTES.sdrCampanhaNova)}>
          + Nova campanha
        </Button>
      </div>

      <SdrSubNav />

      {error && <EmptyState title="Não foi possível carregar as campanhas" message={error.message} />}

      {!error && !loading && campaigns && campaigns.length === 0 && (
        <EmptyState
          title="Nenhuma campanha ainda"
          message='Clique em "Nova campanha" pra configurar a primeira (nicho, localidades, termos de busca).'
        />
      )}

      {!error && campaigns && campaigns.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Nicho</th>
                <th>Localidades</th>
                <th>Status</th>
                <th>Alvo</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  className={styles.row}
                  onClick={() => navigate(ROUTES.sdrCampanhaEditar(c.id))}
                >
                  <td>{c.name}</td>
                  <td>{c.niche}</td>
                  <td>
                    {c.locations
                      .map((l) => l.city ?? l.state ?? l.country ?? l.locality)
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td>
                    <Badge label={SDR_CAMPAIGN_STATUS_LABEL[c.status]} {...STATUS_COLOR[c.status]} />
                  </td>
                  <td>{c.targetQuantity || "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Button
                      onClick={() => {
                        setSelectedMode("find_new");
                        setStartingCampaignId(c.id);
                      }}
                    >
                      Iniciar garimpo
                    </Button>
                  </td>
                  <td className={styles.chevron}>›</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {startingCampaignId && (
        <Modal
          title="Iniciar garimpo"
          subtitle="O backend decide o que pular com base no modo escolhido e na cobertura já registrada."
          onClose={() => setStartingCampaignId(null)}
        >
          {RUN_MODES.map((mode) => (
            <label key={mode} className={styles.historyItem} style={{ display: "block", cursor: "pointer" }}>
              <input
                type="radio"
                name="run-mode"
                checked={selectedMode === mode}
                onChange={() => setSelectedMode(mode)}
                style={{ marginRight: 8 }}
              />
              {SDR_RUN_MODE_LABEL[mode]}
            </label>
          ))}
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setStartingCampaignId(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void handleStartRun()} disabled={starting}>
              Iniciar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
