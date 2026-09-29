import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { formatCountdown, isReadOnlySupport, secondsLeft } from "../../auth/impersonation";
import { ReasonDialog } from "../../platform/ReasonDialog";
import styles from "./SupportBanner.module.css";

/**
 * Faixa fixa enquanto a pessoa está numa SESSÃO DE SUPORTE (impersonation):
 * de quem é o tenant, modo (somente leitura / escrita), tempo restante,
 * liberar escrita (com motivo) e encerrar. Nunca some enquanto a sessão
 * existir — não dá para "esquecer" que está dentro do CRM de um cliente.
 */
export function SupportBanner() {
  const { user, currentTenantName, elevateImpersonation, endImpersonation } = useAuth();
  const { toast, toastError } = useToast();
  const info = user?.impersonation ?? null;
  const [now, setNow] = useState(() => new Date());
  const [elevating, setElevating] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!info) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [info]);

  if (!info) return null;
  const remaining = secondsLeft(info.expiresAt, now);
  const readOnly = isReadOnlySupport(info);
  const tenantName = user?.tenantName ?? currentTenantName ?? "cliente";

  async function elevate(reason: string): Promise<boolean> {
    try {
      await elevateImpersonation(reason);
      toast("Escrita liberada nesta sessão — tudo continua auditado", "warning");
      return true;
    } catch (err) {
      toastError(err, "Não foi possível liberar a escrita.");
      return false;
    }
  }

  async function end() {
    setEnding(true);
    try {
      await endImpersonation();
    } catch (err) {
      toastError(err, "Não foi possível encerrar a sessão de suporte.");
      setEnding(false);
    }
  }

  return (
    <div className={readOnly ? styles.banner : `${styles.banner} ${styles.write}`} role="status">
      <span className={styles.text}>
        <b>MODO SUPORTE GSM</b> — você está vendo o CRM de <b>{tenantName}</b> ·{" "}
        {readOnly ? "somente leitura" : "ESCRITA LIBERADA"} · encerra em {formatCountdown(remaining)}
      </span>
      <span className={styles.actions}>
        {readOnly && (
          <button type="button" className={styles.btn} onClick={() => setElevating(true)}>
            Liberar escrita
          </button>
        )}
        <button
          type="button"
          className={`${styles.btn} ${styles.btnStrong}`}
          onClick={() => void end()}
          disabled={ending}
        >
          {ending ? "Encerrando…" : "Encerrar suporte"}
        </button>
      </span>
      {elevating && (
        <ReasonDialog
          title="Liberar escrita nesta sessão?"
          message="Alterações feitas a partir de agora ficam marcadas como feitas pelo suporte da GSM. Gerenciar usuários, exportar e excluir continuam bloqueados."
          confirmLabel="Liberar escrita"
          danger
          onConfirm={elevate}
          onClose={() => setElevating(false)}
        />
      )}
    </div>
  );
}
