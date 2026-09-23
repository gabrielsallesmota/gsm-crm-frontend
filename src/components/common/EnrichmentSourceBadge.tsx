import {
  SDR_ENRICHMENT_SOURCE_LABEL,
  SDR_ENRICHMENT_STATUS_LABEL,
  type SdrEnrichmentSource,
  type SdrEnrichmentStatus,
} from "../../types/sdr";
import { Badge } from "./Badge";

const STATUS_COLOR: Record<SdrEnrichmentStatus, { color: string; bg: string }> = {
  success: { color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  not_found: { color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  unavailable: { color: "var(--tone-red)", bg: "var(--tone-red-bg)" },
  not_configured: { color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
  skipped: { color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
};

/** Fonte + status de uma tentativa de enriquecimento (ex.: "ReceitaWS —
 * Sucesso"), mesmo padrão visual de badge já usado pra status de
 * candidate/campanha — não existia nenhum equivalente antes da Etapa 3
 * porque não havia enriquecimento nenhum. */
export function EnrichmentSourceBadge({
  source,
  status,
}: {
  source: SdrEnrichmentSource;
  status: SdrEnrichmentStatus;
}) {
  const label = `${SDR_ENRICHMENT_SOURCE_LABEL[source]} — ${SDR_ENRICHMENT_STATUS_LABEL[status]}`;
  return <Badge label={label} {...STATUS_COLOR[status]} />;
}
