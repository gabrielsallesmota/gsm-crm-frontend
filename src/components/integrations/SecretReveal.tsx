import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import form from "../common/Form.module.css";
import styles from "./Integrations.module.css";

/**
 * Mostra um segredo recém-gerado UMA vez (credencial da API ou secret de
 * webhook). O valor vive só no estado deste modal: não vai para storage,
 * toast, log nem URL — fechou, acabou. O backend guarda só hash (API) ou
 * texto cifrado (webhook) e nunca devolve o valor de novo.
 */
export function SecretReveal({
  title,
  label,
  secret,
  extra,
  onClose,
}: {
  title: string;
  label: string;
  secret: string;
  extra?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal title={title} onClose={() => (acknowledged ? onClose() : undefined)}>
      <div className={styles.warning}>
        <strong>Copie agora.</strong> Por segurança este valor não será mostrado de novo — nem
        para você, nem para o suporte. Se perder, gere um novo (rotação).
      </div>
      <div className={form.field} style={{ marginTop: 12 }}>
        <span className={form.label}>{label}</span>
        <div className={styles.secretBox}>
          <input
            className={styles.secretValue}
            value={secret}
            readOnly
            aria-label={label}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button variant="primary" onClick={() => void copy()}>
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        {extra && <span className={form.hint}>{extra}</span>}
      </div>
      <label className={styles.checkItem} style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <span>Guardei este valor em um local seguro.</span>
      </label>
      <div className={form.actions}>
        <Button variant="primary" onClick={onClose} disabled={!acknowledged}>
          Concluir
        </Button>
      </div>
    </Modal>
  );
}
