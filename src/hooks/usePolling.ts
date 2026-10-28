import { useEffect, useRef } from "react";

/** Chama `tick` a cada `ms` enquanto `enabled` e a aba estiver visível (volta a chamar na hora em
 * que a aba reaparece). Um tick por vez: se o anterior ainda não terminou, pula. */
export function usePolling(tick: () => Promise<unknown>, ms: number, enabled = true): void {
  const latest = useRef(tick);
  latest.current = tick;

  useEffect(() => {
    if (!enabled) return;
    let running = false;
    const run = () => {
      if (running || document.hidden) return;
      running = true;
      latest
        .current()
        .catch(() => undefined) // erro de rede: tenta no próximo ciclo
        .finally(() => {
          running = false;
        });
    };
    const timer = window.setInterval(run, ms);
    const onVisible = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}
