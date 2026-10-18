import styles from "./ImportWizard.module.css";

export type WizardStep = "file" | "columns" | "review" | "importing" | "result";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "file", label: "Arquivo" },
  { key: "columns", label: "Colunas" },
  { key: "review", label: "Revisão" },
  { key: "importing", label: "Importação" },
  { key: "result", label: "Resultado" },
];

/** Indicador discreto das 5 etapas; a atual é anunciada por `aria-current="step"`. */
export function ImportStepper({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className={styles.stepper} aria-label="Etapas da importação">
      {STEPS.map((step, index) => {
        const state =
          index < currentIndex ? styles.stepDone : index === currentIndex ? styles.stepCurrent : "";
        return (
          <li
            key={step.key}
            className={[styles.step, state].filter(Boolean).join(" ")}
            {...(index === currentIndex ? { "aria-current": "step" as const } : {})}
          >
            <span className={styles.stepNumber} aria-hidden="true">
              {index < currentIndex ? "✓" : index + 1}
            </span>
            <span className={styles.stepLabel}>
              <span className="sr-only">
                {index < currentIndex ? "Concluída: " : index === currentIndex ? "Etapa atual: " : ""}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
