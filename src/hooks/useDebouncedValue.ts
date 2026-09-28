import { useEffect, useState } from "react";

/** Valor que só "assenta" depois de `delayMs` sem mudar — busca digitada não
 * dispara uma requisição por tecla (Etapa 1: busca com debounce). */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
