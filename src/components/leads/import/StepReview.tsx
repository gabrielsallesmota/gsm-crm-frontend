import { useId } from "react";
import type { DedupeStrategy } from "../../../types/lead";
import type { PipelineStage } from "../../../types/pipeline";
import type { DirectoryMember } from "../../../types/user";
import { IMPORTABLE_LEAD_FIELDS } from "../../../types/lead";
import { IGNORE, type Prepared } from "../../../utils/leadImport";
import styles from "./ImportWizard.module.css";

const fmt = (n: number) => n.toLocaleString("pt-BR");

const DEDUPE_HELP: Record<DedupeStrategy, string> = {
  skip: "A linha é ignorada e aparece no relatório como duplicada.",
  update: "O cadastro existente é atualizado com os dados da planilha.",
  duplicate: "Um novo lead é criado mesmo com o telefone repetido (gera duplicados).",
};

/** Etapa 3 — conferir tudo antes de enviar. Nada foi enviado até aqui. */
export function StepReview({
  fileName,
  prepared,
  batchCount,
  headers,
  mapping,
  stages,
  stageId,
  onStage,
  canAssign,
  team,
  ownerId,
  onOwner,
  currentUserId,
  dedupe,
  onDedupe,
  blockedReason,
  blockedId,
}: {
  fileName: string;
  prepared: Prepared;
  batchCount: number;
  headers: string[];
  mapping: string[];
  stages: PipelineStage[];
  stageId: string;
  onStage: (id: string) => void;
  canAssign: boolean;
  team: DirectoryMember[] | null | undefined;
  ownerId: string;
  onOwner: (id: string) => void;
  currentUserId: string | undefined;
  dedupe: DedupeStrategy;
  onDedupe: (s: DedupeStrategy) => void;
  blockedReason: string | null;
  blockedId: string;
}) {
  const uid = useId();
  const valid = prepared.valid.length;
  const mapped = headers
    .map((h, i) => ({ header: h, field: mapping[i] ?? IGNORE }))
    .filter((m) => m.field !== IGNORE);
  const labelOf = (key: string) => IMPORTABLE_LEAD_FIELDS.find((f) => f.key === key)?.label ?? key;
  return (
    <>
      <h3 className={styles.title}>Revise e confirme</h3>
      <p className={styles.lead}>Nada foi enviado ainda. Confira os números e escolha como importar.</p>

      <div className={styles.settings}>
        <div>
          <label className={styles.label} htmlFor={`${uid}-stage`}>
            Estágio de entrada (leads novos)
          </label>
          <select
            id={`${uid}-stage`}
            className={styles.select}
            value={stageId}
            onChange={(e) => onStage(e.target.value)}
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {canAssign && (
          <div>
            <label className={styles.label} htmlFor={`${uid}-owner`}>
              Responsável pelos leads novos
            </label>
            <select
              id={`${uid}-owner`}
              className={styles.select}
              value={ownerId}
              onChange={(e) => onOwner(e.target.value)}
            >
              {team?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              {!team && currentUserId && <option value={currentUserId}>Eu</option>}
            </select>
          </div>
        )}
        <div>
          <label className={styles.label} htmlFor={`${uid}-dedupe`}>
            Se o telefone já existir
          </label>
          <select
            id={`${uid}-dedupe`}
            className={styles.select}
            value={dedupe}
            aria-describedby={`${uid}-dedupe-help`}
            onChange={(e) => onDedupe(e.target.value as DedupeStrategy)}
          >
            <option value="skip">Ignorar a linha</option>
            <option value="update">Atualizar o cadastro existente</option>
            <option value="duplicate">Cadastrar mesmo assim (duplicar)</option>
          </select>
          <p id={`${uid}-dedupe-help`} className={styles.note}>
            {DEDUPE_HELP[dedupe]}
          </p>
        </div>
      </div>

      <section aria-label="Pré-importação" className={styles.summary}>
        <p className={styles.summaryTitle}>Pré-importação: {fileName}</p>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Linhas</dt>
            <dd>{fmt(prepared.totalRows)}</dd>
          </div>
          <div className={`${styles.stat} ${styles.statGood}`}>
            <dt>Válidas</dt>
            <dd>{fmt(valid)}</dd>
          </div>
          <div className={`${styles.stat} ${prepared.invalid.length ? styles.statBad : ""}`}>
            <dt>Inválidas</dt>
            <dd>{fmt(prepared.invalid.length)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Lotes</dt>
            <dd>{fmt(batchCount)}</dd>
          </div>
        </dl>
        {prepared.invalid.length > 0 && prepared.nameMapped && (
          <p className={styles.note}>
            {fmt(prepared.invalid.length)} linha(s) não serão enviadas e aparecerão no relatório com o motivo
            (ex.: linha {prepared.invalid[0]!.rowNumber}: {prepared.invalid[0]!.detail})
          </p>
        )}
        {prepared.warnings.unknownOrigin > 0 && (
          <p className={`${styles.note} ${styles.warn}`}>
            {fmt(prepared.warnings.unknownOrigin)} linha(s) com origem desconhecida: os leads serão criados sem
            origem.
          </p>
        )}
        {prepared.warnings.shortPhone > 0 && (
          <p className={`${styles.note} ${styles.warn}`}>
            {fmt(prepared.warnings.shortPhone)} linha(s) com telefone curto (menos de 10 dígitos): não detectam
            duplicados por telefone.
          </p>
        )}
        <p className={styles.note}>
          “Válida” significa apenas que passou nas checagens do navegador; o servidor ainda pode ignorar
          duplicados ou recusar linhas, e tudo aparece no relatório final.
        </p>
      </section>

      <section aria-label="Resumo do mapeamento" className={styles.summary}>
        <p className={styles.summaryTitle}>Colunas que serão importadas ({mapped.length})</p>
        <p className={styles.note} style={{ marginTop: 0 }}>
          {mapped.length > 0
            ? mapped.map((m) => `${m.header} → ${labelOf(m.field)}`).join(" · ")
            : "Nenhuma coluna relacionada."}
        </p>
      </section>

      {blockedReason && (
        <p id={blockedId} role="status" className={`${styles.note} ${styles.warn}`}>
          {blockedReason}
        </p>
      )}
    </>
  );
}
