import { useEffect, useState } from "react";

/** Breakpoints do Design System (`02_DESIGN_SYSTEM.md`) — espelham os `@media` dos CSS Modules. */
export const BREAKPOINTS = {
  /** Abaixo disto: celular (uma etapa por vez). */
  mobileMax: 760,
  /** Abaixo disto: cabeçalho empilha. */
  compactMax: 900,
} as const;

/**
 * `matchMedia` reativo. Sem `matchMedia` (testes em jsdom, SSR) devolve `false`: a interface se
 * comporta como desktop, que é o layout completo.
 */
export function useMediaQuery(query: string): boolean {
  const read = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export const useIsMobile = () => useMediaQuery(`(max-width: ${BREAKPOINTS.mobileMax}px)`);
