import type { ReactNode } from "react";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import type { AsyncResourceState } from "../../hooks/useAsyncResource";

/** Só o que a barreira precisa — aceita o estado de qualquer recurso. */
type GateState = Pick<AsyncResourceState<unknown>, "notImplemented" | "error" | "reload">;
import { ApiError } from "../../types/common";
import { describeError } from "../../utils/apiErrors";

/** Estados comuns de carga das telas de notificação: carregando, demonstração
 * (sem API), 401/403/404/rede e erro genérico — com mensagem segura. */
export function ResourceGate<T>({
  state,
  value,
  demoMessage = "A Central de Notificações usa a API real e não funciona no modo demonstração.",
  children,
}: {
  state: GateState;
  /** Dado já tratado pelo pai (ex.: com override de salvamento). */
  value: T | null;
  /** Texto do estado "demonstração" (cada tela diz o que não está disponível). */
  demoMessage?: string;
  children: (data: T) => ReactNode;
}) {
  if (state.notImplemented) {
    return (
      <EmptyState
        tone="empty"
        title="Indisponível na demonstração"
        message={demoMessage}
      />
    );
  }
  if (state.error && !value) {
    const err = state.error;
    const forbidden = err instanceof ApiError && (err.status === 403 || err.status === 401);
    return (
      <EmptyState
        tone={
          forbidden
            ? "forbidden"
            : err instanceof ApiError && err.status === 0
              ? "offline"
              : "error"
        }
        title={forbidden ? "Sem acesso" : "Não foi possível carregar"}
        message={describeError(err, "Tente novamente em instantes.")}
        {...(forbidden ? {} : { action: { label: "Tentar de novo", onClick: state.reload } })}
      />
    );
  }
  if (!value) return <SkeletonRows rows={6} label="Carregando notificações" />;
  return <>{children(value)}</>;
}
