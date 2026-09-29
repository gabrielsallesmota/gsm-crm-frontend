import type { ReactNode } from "react";
import { copyright, DEFAULT_BRAND } from "../config/brand";
import styles from "./AuthLayout.module.css";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.shell} theme-dark`}>
      <div className={styles.panel}>
        <div className={styles.glow} />
        <div className={styles.logo}>
          &lt;{DEFAULT_BRAND.logoMark} <span className={styles.logoAccent}>/&gt;</span>
          <span className={styles.logoSub}>{DEFAULT_BRAND.logoSuffix}</span>
        </div>
        <div className={styles.pitch}>
          <div className={styles.kicker}>// CRM PARA EQUIPES DE VENDAS</div>
          <h1 className={styles.title}>
            Todo o seu funil
            <br />
            num lugar só.
          </h1>
          <p className={styles.subtitle}>
            Leads, pipeline, tarefas, agenda e relatórios. Simples como precisa ser, completo como
            um CRM de verdade.
          </p>
          <div className={styles.checks}>
            <span>✓ Funil visual</span>
            <span>✓ Funciona no celular</span>
            <span>✓ Integra com site e WhatsApp</span>
          </div>
        </div>
        <div className={styles.footer}>
          {copyright()} ·{" "}
          <a href={DEFAULT_BRAND.website} target="_blank" rel="noreferrer">
            {DEFAULT_BRAND.websiteLabel}
          </a>
        </div>
      </div>
      <div className={styles.formSide}>{children}</div>
    </div>
  );
}
