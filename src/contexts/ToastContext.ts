import { createContext } from "react";

/** Tipo do feedback — define ícone, cor e anúncio para leitor de tela.
 * Erro NUNCA usa o ✓ verde (padrão global da Etapa 1). */
export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  /** Sem `variant` = sucesso (o uso histórico de `toast()` era confirmação). */
  toast: (message: string, variant?: ToastVariant) => void;
  /** Erro de uma ação assíncrona: traduz o status HTTP (401/403/404/409/
   * 422/429/5xx/rede) para uma mensagem de usuário — ver `describeError`. */
  toastError: (err: unknown, fallback: string) => void;
  dismiss: (id: number) => void;
}

// Só o Context + o tipo aqui — nenhum componente neste arquivo, de
// propósito (é o que deixa `ToastProvider.tsx` exportar só o componente,
// satisfazendo a regra `react-refresh/only-export-components`).
export const ToastContext = createContext<ToastContextValue | null>(null);
