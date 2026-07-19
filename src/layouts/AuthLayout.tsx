import type { ReactNode } from "react";
import styles from "./AuthLayout.module.css";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.panel}>
        <div className={styles.glow} />
        <div className={styles.logo}>
          &lt;GSM <span className={styles.logoAccent}>/&gt;</span>
          <span className={styles.logoSub}>CRM</span>
        </div>
        <div className={styles.pitch}>
          <div className={styles.kicker}>// CRM SAAS · MULTI-EMPRESA</div>
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
            <span>✓ Kanban arrastável</span>
            <span>✓ Multi-tenant</span>
            <span>✓ Pronto para IA</span>
          </div>
        </div>
        <div className={styles.footer}>© 2026 GSM Automação · gsmautomacao.com.br</div>
      </div>
      <div className={styles.formSide}>{children}</div>
    </div>
  );
}
