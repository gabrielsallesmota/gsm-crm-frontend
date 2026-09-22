import { useTheme } from "../../hooks/useTheme";
import { NavIcon } from "./NavIcon";
import styles from "./ThemeToggle.module.css";

/** Alterna claro/escuro — mostra o ícone do tema PARA O QUAL vai trocar (sol
 * quando está no escuro, lua quando está no claro), convenção da maioria dos
 * toggles de tema. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const goingTo = theme === "light" ? "escuro" : "claro";
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={`Ativar modo ${goingTo}`}
      title={`Ativar modo ${goingTo}`}
    >
      <NavIcon name={theme === "light" ? "moon" : "sun"} size={17} />
    </button>
  );
}
