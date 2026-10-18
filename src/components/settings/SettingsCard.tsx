import type { ReactNode } from "react";
import styles from "./Settings.module.css";

/** Cartão de uma configuração: título (h2), explicação curta e, à direita, a ação principal. */
export function SettingsCard({
  title,
  description,
  internal = false,
  actions,
  children,
}: {
  title: string;
  description?: string;
  /** Marca a seção como ferramenta interna da GSM (visível só para staff). */
  internal?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.cardHead}>
        <div>
          {internal && <span className={styles.badgeInternal}>interno GSM</span>}
          <h2 className={styles.cardTitle}>{title}</h2>
          {description && <p className={styles.cardDesc}>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
