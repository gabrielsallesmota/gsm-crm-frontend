import { useState } from "react";
import type { ApplyScope } from "../../types/finance";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import form from "../common/Form.module.css";

const OPTIONS: [ApplyScope, string, string][] = [
  ["this", "Somente este lançamento", "Os outros da série ficam como estão."],
  ["future", "Este e os seguintes", "Também muda os próximos que ainda não foram pagos."],
  ["all", "Todos da série", "Também muda os anteriores que ainda não foram pagos."],
];

/**
 * Edição de lançamento que faz parte de uma série (mensal ou fixo): pergunta onde aplicar. Valor,
 * descrição, categoria, conta, PF/PJ, forma de pagamento e observações propagam; datas e a baixa valem
 * só para o item editado, e itens já pagos nunca mudam.
 */
export function SeriesApplyDialog({
  description,
  busy,
  onConfirm,
  onClose,
}: {
  description: string;
  busy: boolean;
  onConfirm: (apply: ApplyScope) => void;
  onClose: () => void;
}) {
  const [apply, setApply] = useState<ApplyScope>("this");
  return (
    <Modal title="Aplicar a quais lançamentos?" onClose={busy ? () => undefined : onClose}>
      <p style={{ margin: "8px 0 12px", fontSize: 13.5, lineHeight: 1.5 }}>
        “{description}” faz parte de uma série. Onde essa alteração deve valer?
      </p>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend className="sr-only">Aplicar em</legend>
        {OPTIONS.map(([value, label, hint]) => (
          <label
            key={value}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              border: `1px solid ${apply === value ? "var(--tone-blue-text)" : "var(--border-strong)"}`,
              background: apply === value ? "var(--tone-blue-bg)" : "transparent",
              borderRadius: "var(--radius-input)",
              padding: "10px 12px",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="apply"
              value={value}
              checked={apply === value}
              onChange={() => setApply(value)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ display: "block", color: "var(--heading)", fontSize: 13.5 }}>{label}</strong>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className={form.actions}>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => onConfirm(apply)} disabled={busy}>
          {busy ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </Modal>
  );
}
