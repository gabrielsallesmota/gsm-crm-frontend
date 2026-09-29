import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useOnboarding } from "../../hooks/useOnboarding";
import { DEFAULT_BRAND } from "../../config/brand";
import styles from "./OnboardingChecklist.module.css";

/**
 * Primeiros passos (Etapa 4) — cartão no topo do Dashboard. Não bloqueia
 * nada: pode ser minimizado ou pulado a qualquer momento ("Pular
 * tutorial"). Quando todos os passos estão feitos, vira um aviso de
 * "tudo pronto" que a pessoa fecha.
 */
export function OnboardingChecklist() {
  const { user } = useAuth();
  const { visible, loading, progress, dismiss } = useOnboarding();
  const [collapsed, setCollapsed] = useState(false);

  if (!visible || loading) return null;

  const firstName = user?.name.split(" ")[0] ?? "";
  const pct = progress.total ? Math.round((progress.doneCount / progress.total) * 100) : 0;

  if (progress.complete) {
    return (
      <section className={`${styles.card} ${styles.complete}`} aria-label="Primeiros passos">
        <div className={styles.head}>
          <div>
            <h2 className={styles.title}>Tudo pronto{firstName ? `, ${firstName}` : ""}!</h2>
            <p className={styles.subtitle}>
              Você concluiu os primeiros passos. A ajuda (?) continua disponível nas telas.
            </p>
          </div>
          <button type="button" className={styles.linkBtn} onClick={dismiss}>
            Fechar
          </button>
        </div>
      </section>
    );
  }

  const next = progress.steps.find((s) => !s.done);

  return (
    <section className={styles.card} aria-labelledby="onboarding-title">
      <div className={styles.head}>
        <div>
          <h2 id="onboarding-title" className={styles.title}>
            {progress.doneCount === 0
              ? `Boas-vindas ao ${DEFAULT_BRAND.productName}${firstName ? `, ${firstName}` : ""}`
              : "Primeiros passos"}
          </h2>
          <p className={styles.subtitle}>
            {progress.doneCount} de {progress.total} concluídos · leva poucos minutos, e você pode
            usar o sistema normalmente enquanto isso.
          </p>
        </div>
        <div className={styles.headActions}>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-controls="onboarding-steps"
          >
            {collapsed ? "Mostrar" : "Minimizar"}
          </button>
          <button type="button" className={styles.linkBtn} onClick={dismiss}>
            Pular tutorial
          </button>
        </div>
      </div>

      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Progresso dos primeiros passos"
      >
        <span style={{ width: `${pct}%` }} />
      </div>

      {!collapsed && (
        <ol id="onboarding-steps" className={styles.steps}>
          {progress.steps.map((step) => (
            <li
              key={step.id}
              className={[styles.step, step.done && styles.done, step === next && styles.next]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={styles.check} aria-hidden="true">
                {step.done ? "✓" : ""}
              </span>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>
                  {step.title}
                  <span className="sr-only">{step.done ? " (concluído)" : " (pendente)"}</span>
                </div>
                {!step.done && <p className={styles.stepText}>{step.description}</p>}
              </div>
              {!step.done && (
                <Link to={step.to} className={step === next ? styles.ctaPrimary : styles.cta}>
                  {step.cta}
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
