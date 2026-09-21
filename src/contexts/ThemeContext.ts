import { createContext } from "react";

export type Theme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

// Só o Context + os tipos aqui — nenhum componente neste arquivo, de
// propósito (mesma razão de `ToastContext.ts`: deixa `ThemeProvider.tsx`
// exportar só o componente, satisfazendo `react-refresh/only-export-components`).
export const ThemeContext = createContext<ThemeContextValue | null>(null);
