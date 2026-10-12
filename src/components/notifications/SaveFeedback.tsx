import { Button } from "../common/Button";
import type { SaveState } from "../../utils/saveState";
import styles from "./Notifications.module.css";

export function SaveFeedback({ state, onReload }: { state: SaveState; onReload: () => void }) {
  if (state.kind === "saved") {
    return (
      <p className={`${styles.notice} ${styles.success}`} role="status">
        {state.message}
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p className={`${styles.notice} ${styles.danger}`} role="alert">
        {state.message}
      </p>
    );
  }
  if (state.kind === "conflict") {
    return (
      <div className={`${styles.notice} ${styles.caution}`} role="alert">
        <p style={{ margin: "0 0 8px" }}>
          Estas configurações foram alteradas em outra sessão. Suas mudanças NÃO foram salvas —
          recarregue para ver a versão atual e refaça o ajuste.
        </p>
        <Button onClick={onReload}>Recarregar configurações</Button>
      </div>
    );
  }
  return null;
}
