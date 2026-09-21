import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type Theme, type ThemeContextValue } from "./ThemeContext";

// Mesma chave do script inline em `index.html`, que já aplica o tema salvo
// ANTES do primeiro paint (sem isso a tela piscaria escura por um instante
// antes do React montar). Padrão: claro.
const STORAGE_KEY = "gsm_theme";

function readInitialTheme(): Theme {
  // O script do `index.html` já resolveu isso (inclusive o caso de storage
  // indisponível) — confiar nele evita duas fontes de verdade diferentes.
  if (typeof document !== "undefined") {
    const applied = document.documentElement.getAttribute("data-theme");
    if (applied === "dark" || applied === "light") return applied;
  }
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage indisponível (modo privado, quota etc.) — a preferência só
      // não persiste entre sessões, sem quebrar a troca em si.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
