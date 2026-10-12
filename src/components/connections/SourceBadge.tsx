import { safeExternalUrl, sourceLabel } from "../../utils/connections";
import styles from "./Connections.module.css";

/**
 * Origem de um item da agenda/tarefas unificada. Itens do CRM não mostram
 * nada; os do Google/Microsoft mostram a origem e o link para abrir o
 * original (somente http/https, em nova aba).
 */
export function SourceBadge({
  source,
  url,
  readOnly,
}: {
  source: string | undefined;
  url: string | null | undefined;
  readOnly?: boolean | undefined;
}) {
  if (!source || source === "crm") return null;
  const label = sourceLabel(source);
  const href = safeExternalUrl(url);
  return (
    <span>
      <span className={styles.chip} title={readOnly ? "Somente leitura no CRM" : undefined}>
        {label}
      </span>
      {href && (
        <>
          {" "}
          <a href={href} target="_blank" rel="noopener noreferrer">
            Abrir no {label}
          </a>
        </>
      )}
    </span>
  );
}
