import { ORIGIN } from "../../constants/origins";
import { SettingsCard } from "./SettingsCard";
import styles from "./Settings.module.css";

/** Origens: conjunto FIXO (D-04) — só leitura. Não há cadastro dinâmico nesta tela. */
export function OriginsSection() {
  return (
    <SettingsCard
      title="Origens"
      description="De onde o lead veio. O conjunto de origens é fixo e é usado nos filtros, nos modelos de mensagem e nas integrações; não é editável aqui."
    >
      <ul className={styles.originList}>
        {Object.values(ORIGIN).map((origin) => (
          <li key={origin.label} className={styles.originItem}>
            {/* texto na cor do tema (contraste); só o ícone decorativo leva a cor da origem */}
            <span className={styles.originChip} style={{ background: origin.bg }}>
              <span aria-hidden="true" style={{ color: origin.color }}>
                {origin.icon}
              </span>{" "}
              {origin.label}
            </span>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}
