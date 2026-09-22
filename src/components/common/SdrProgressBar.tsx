import styles from "./SdrProgressBar.module.css";

/** Barra percentual simples — `processedCount / targetQuantity`, sem
 * pretensão de ser exata (não sabemos quantas páginas de busca existem de
 * antemão, ver `StartCampaignRunUseCase` no backend). `targetQuantity` 0
 * (campanha sem alvo definido) mostra a barra cheia só como indicador de
 * "em andamento", não como progresso real. */
export function SdrProgressBar({
  processedCount,
  targetQuantity,
}: {
  processedCount: number;
  targetQuantity: number;
}) {
  const percent =
    targetQuantity > 0 ? Math.min(100, Math.round((processedCount / targetQuantity) * 100)) : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.label}>
        {targetQuantity > 0 ? `${percent}% (${processedCount}/${targetQuantity})` : `${processedCount} processados`}
      </span>
    </div>
  );
}
