import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  KIOSK_UNAUTHORIZED_EVENT,
  getKioskToken,
  setKioskToken,
} from "../../repositories/api/operationsAuth";

/**
 * Pareamento do terminal "Terapeuta da Vez". Continua SEM login do CRM
 * (pedido do cliente), mas o painel só abre depois que alguém da loja
 * informa, uma vez, o código do dispositivo (`OPERATIONS_KIOSK_TOKEN` no
 * backend). Se o backend recusar o código (401 — ex.: código trocado), o
 * repositório limpa o código salvo e dispara `KIOSK_UNAUTHORIZED_EVENT`,
 * que traz esta tela de volta.
 */
export function KioskGate({ children }: { children: ReactNode }) {
  const [paired, setPaired] = useState(() => getKioskToken() !== null);
  const [code, setCode] = useState("");
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    function onUnauthorized() {
      setRejected(true);
      setPaired(false);
    }
    window.addEventListener(KIOSK_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(KIOSK_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;
    setKioskToken(value);
    setCode("");
    setRejected(false);
    setPaired(true);
  }

  if (paired) return <>{children}</>;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "var(--bg, #0f1115)",
        color: "var(--text, #e8eaed)",
      }}
    >
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 380, display: "grid", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Autorizar este terminal</h1>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Informe o código do dispositivo para liberar o painel neste computador. Ele é pedido só
          uma vez.
        </p>
        {rejected && (
          <p role="alert" style={{ margin: 0, color: "#ff8a8a" }}>
            Código inválido ou revogado. Informe o código atual do dispositivo.
          </p>
        )}
        <label htmlFor="kiosk-code">Código do dispositivo</label>
        <input
          id="kiosk-code"
          type="password"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ padding: "10px 12px", fontSize: 16 }}
        />
        <button type="submit" disabled={!code.trim()} style={{ padding: "10px 12px", fontSize: 16 }}>
          Autorizar
        </button>
      </form>
    </main>
  );
}
