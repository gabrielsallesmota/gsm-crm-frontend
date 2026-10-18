import { Link } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import type { Pipeline } from "../../types/pipeline";
import { brl } from "../../utils/currency";
import type { BoardSummary } from "../../utils/pipelineView";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { HelpTip } from "../common/HelpTip";
import { IconDownload, IconPlus, IconUpload } from "../common/Icons";
import styles from "./PipelineHeader.module.css";

const PASSIVO_BADGE = { label: "Passivo", color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" };

/**
 * Cabeçalho do Pipeline (Prompt 06). Responde: qual pipeline? quantas oportunidades? como criar/
 * importar/exportar? Os números são os `total` REAIS do servidor (ver `boardSummary`); o valor em R$
 * só aparece quando todas as etapas em andamento estão inteiras no navegador.
 */
export function PipelineHeader({
  pipeline,
  pipelines,
  onPipelineChange,
  summary,
  taggedPassivo,
  onImport,
  onExport,
}: {
  pipeline: Pipeline;
  pipelines: Pipeline[];
  onPipelineChange: (id: string) => void;
  summary: BoardSummary;
  taggedPassivo: boolean;
  onImport: () => void;
  onExport: () => void;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>
          {taggedPassivo && <Badge {...PASSIVO_BADGE} />} Pipeline
        </h1>
        {pipelines.length > 1 ? (
          <select
            className={styles.pipelineSelect}
            value={pipeline.id}
            onChange={(e) => onPipelineChange(e.target.value)}
            aria-label="Pipeline"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <span className={styles.pipelineName}>{pipeline.name}</span>
        )}
        <HelpTip label="Como funciona o pipeline">
          <span>
            Cada coluna é uma etapa da venda. Quando a negociação avança, mova o lead para a próxima
            etapa: arrastando o card, pelo seletor de etapa do card (no celular) ou abrindo o lead.
          </span>
          <span>
            Etapas com 🏆 contam como <b>ganho</b> e com ✕ como <b>perda</b> — é isso que alimenta a
            conversão e a receita do Dashboard.
          </span>
        </HelpTip>
      </div>

      <p className={styles.summary} aria-live="polite">
        {summary.ready ? (
          <>
            <strong>{summary.total.toLocaleString("pt-BR")}</strong>{" "}
            {summary.total === 1 ? "oportunidade" : "oportunidades"}
            <span className={styles.sep} aria-hidden="true">
              ·
            </span>
            <strong>{summary.open.toLocaleString("pt-BR")}</strong> em andamento
            {summary.openValue !== null && summary.openValue > 0 && (
              <>
                {" "}
                (<strong>R$ {brl(summary.openValue)}</strong>)
              </>
            )}
          </>
        ) : (
          <span className={styles.muted}>Carregando totais…</span>
        )}
      </p>

      <div className={styles.actions}>
        <Link className={styles.primary} to={`${ROUTES.leads}?novo=1`}>
          <IconPlus size={16} /> Novo lead
        </Link>
        {/* O nome acessível é sempre o completo; em telas estreitas o texto visível encurta. */}
        <Button onClick={onImport} className={styles.secondary} aria-label="Importar planilha">
          <IconUpload size={16} />
          <span className={styles.long}>Importar planilha</span>
          <span className={styles.short} aria-hidden="true">
            Importar
          </span>
        </Button>
        <Button onClick={onExport} className={styles.secondary} aria-label="Exportar CSV">
          <IconDownload size={16} />
          <span className={styles.long}>Exportar CSV</span>
          <span className={styles.short} aria-hidden="true">
            Exportar
          </span>
        </Button>
      </div>
    </header>
  );
}
