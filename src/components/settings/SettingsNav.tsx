import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import styles from "./Settings.module.css";

/** Categorias que aparecem DENTRO da página (a rota continua sendo uma só: `?secao=`). */
export type SettingsCategory = "comercial" | "comunicacao" | "interno";

export interface NavLinkItem {
  to: string;
  label: string;
  hint: string;
}

export interface SettingsNavProps {
  active: SettingsCategory;
  onSelect: (category: SettingsCategory) => void;
  /** Mostra a área interna da GSM (só staff). */
  showInternal: boolean;
  /** Atalhos para OUTRAS páginas, já filtrados por permissão/feature. */
  automation: NavLinkItem[];
  team: NavLinkItem[];
  integrations: NavLinkItem[];
  notifications: NavLinkItem[];
}

const CATEGORY_LABEL: Record<SettingsCategory, { label: string; hint: string }> = {
  comercial: { label: "Pipelines, tags e origens", hint: "Funil de vendas" },
  comunicacao: { label: "Mensagens de WhatsApp", hint: "Modelos por etapa e origem" },
  interno: { label: "Prospecção (GSM)", hint: "Área interna da GSM" },
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.navGroup}>
      <h2 className={styles.navGroupTitle}>{title}</h2>
      {children}
    </div>
  );
}

function ExternalLink({ item }: { item: NavLinkItem }) {
  return (
    <Link to={item.to} className={styles.navItem} aria-label={item.label}>
      {item.label}
      <span className={styles.navItemHint}>{item.hint}</span>
    </Link>
  );
}

/**
 * Navegação das Configurações: categorias da própria página (botões) e atalhos para as telas
 * vizinhas (links, só para quem tem permissão). No celular vira um seletor compacto + cartões.
 */
export function SettingsNav(props: SettingsNavProps) {
  const { active, onSelect, showInternal } = props;
  const compact = useMediaQuery("(max-width: 860px)");
  const categories: SettingsCategory[] = showInternal
    ? ["comercial", "comunicacao", "interno"]
    : ["comercial", "comunicacao"];

  if (compact) {
    const links = [...props.notifications, ...props.automation, ...props.team, ...props.integrations];
    return (
      <div className={styles.navMobile}>
        <label className={styles.fieldLabel}>
          Seção
          <select
            className={styles.input}
            value={active}
            onChange={(e) => onSelect(e.target.value as SettingsCategory)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c].label}
              </option>
            ))}
          </select>
        </label>
        {links.map((item) => (
          <Link key={item.to} to={item.to} className={styles.linkCard} aria-label={item.label}>
            <span className={styles.linkCardTitle}>{item.label}</span>
            <span className={styles.linkCardDesc}>{item.hint}</span>
          </Link>
        ))}
      </div>
    );
  }

  const select = (category: SettingsCategory) => (
    <button
      type="button"
      className={active === category ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
      aria-current={active === category ? "page" : undefined}
      onClick={() => onSelect(category)}
    >
      {CATEGORY_LABEL[category].label}
      <span className={styles.navItemHint}>{CATEGORY_LABEL[category].hint}</span>
    </button>
  );

  return (
    <nav className={styles.nav} aria-label="Seções das configurações">
      <Group title="Funil de vendas">{select("comercial")}</Group>
      <Group title="Comunicação">
        {select("comunicacao")}
        {props.notifications.map((item) => (
          <ExternalLink key={item.to} item={item} />
        ))}
      </Group>
      {props.automation.length > 0 && (
        <Group title="Automação">
          {props.automation.map((item) => (
            <ExternalLink key={item.to} item={item} />
          ))}
        </Group>
      )}
      {props.team.length > 0 && (
        <Group title="Equipe e acesso">
          {props.team.map((item) => (
            <ExternalLink key={item.to} item={item} />
          ))}
        </Group>
      )}
      {props.integrations.length > 0 && (
        <Group title="Integrações">
          {props.integrations.map((item) => (
            <ExternalLink key={item.to} item={item} />
          ))}
        </Group>
      )}
      {showInternal && <Group title="Área interna da GSM">{select("interno")}</Group>}
    </nav>
  );
}
