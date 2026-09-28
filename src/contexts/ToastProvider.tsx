import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ToastContext,
  type ToastContextValue,
  type ToastItem,
  type ToastVariant,
} from "./ToastContext";
import { describeError } from "../utils/apiErrors";

let seq = 0;

// Erro/aviso ficam mais tempo na tela: o usuário precisa ler o motivo.
const DURATION_MS: Record<ToastVariant, number> = {
  success: 3200,
  info: 4000,
  warning: 5500,
  error: 6500,
};

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = ++seq;
      // Máximo de 4 empilhados — uma rajada de erros não cobre a tela.
      setToasts((prev) => [...prev.slice(-3), { id, message, variant }]);
      setTimeout(() => dismiss(id), DURATION_MS[variant]);
    },
    [dismiss],
  );

  const toastError = useCallback(
    (err: unknown, fallback: string) => toast(describeError(err, fallback), "error"),
    [toast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, toast, toastError, dismiss }),
    [toasts, toast, toastError, dismiss],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
