import { NavLink } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import styles from "../../pages/SdrPages.module.css";

/** Sem componente de abas reutilizável no projeto hoje — rotas de verdade
 * (`react-router`) pra cada seção, com este navinho simples renderizado
 * dentro de cada página do módulo (não é um layout de rota aninhada, só um
 * componente comum). */
export function SdrSubNav() {
  const items = [
    { to: ROUTES.sdrDashboard, label: "Dashboard" },
    { to: ROUTES.sdrCampanhas, label: "Campanhas" },
    { to: ROUTES.sdrPresets, label: "Presets de ICP" },
    { to: ROUTES.sdrCandidates, label: "Candidates" },
    { to: ROUTES.sdrCobertura, label: "Cobertura" },
    { to: ROUTES.sdrProspectarHoje, label: "Prospectar hoje" },
  ];
  return (
    <nav className={styles.subnav}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            isActive ? `${styles.subnavLink} ${styles.subnavLinkActive}` : styles.subnavLink
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
