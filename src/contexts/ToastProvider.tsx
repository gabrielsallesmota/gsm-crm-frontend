import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ToastContext, type ToastContextValue } from "./ToastContext";

interface ToastItem {
  id: number;
  message: string;
}

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string) => {
    const id = ++seq;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toasts, toast }), [toasts, toast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
