import { createContext } from "react";

interface ToastItem {
  id: number;
  message: string;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  toast: (message: string) => void;
}

// Só o Context + o tipo aqui — nenhum componente neste arquivo, de
// propósito (é o que deixa `ToastProvider.tsx` exportar só o componente,
// satisfazendo a regra `react-refresh/only-export-components`).
export const ToastContext = createContext<ToastContextValue | null>(null);
