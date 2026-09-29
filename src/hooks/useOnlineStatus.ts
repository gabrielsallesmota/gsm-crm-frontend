import { useEffect, useState } from "react";

/** `navigator.onLine` reativo (Etapa 4) — alimenta o aviso de "sem
 * conexão". O navegador só sabe se há rede, não se a API responde; falhas
 * da API continuam indo para o toast/estado de erro de cada tela. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
