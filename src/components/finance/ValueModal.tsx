import { useId, useState } from "react";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import form from "../common/Form.module.css";

/**
 * Pergunta um único número (percentual ou valor em R$) num modal acessível — no lugar de
 * `window.prompt`. `initial` e o valor devolvido ao confirmar usam a mesma unidade do campo
 * (ex.: 6 = 6%, 100 = R$ 100); `allowEmpty` permite confirmar vazio (devolve `null`).
 */
export function ValueModal({
  title,
  label,
  hint,
  initial,
  suffix,
  min = 0,
  max,
  allowEmpty = false,
  confirmLabel = "Confirmar",
  onConfirm,
  onClose,
}: {
  title: string;
  label: string;
  hint?: string;
  initial: string;
  suffix?: string;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  confirmLabel?: string;
  onConfirm: (value: number | null) => void | Promise<void>;
  onClose: () => void;
}) {
  const uid = useId();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);

  const trimmed = text.trim();
  const parsed = trimmed === "" ? null : Number(trimmed.replace(/\./g, "").replace(",", "."));
  const invalid =
    parsed === null
      ? !allowEmpty
      : !Number.isFinite(parsed) || parsed < min || (max !== undefined && parsed > max);

  async function submit() {
    if (invalid || busy) return;
    setBusy(true);
    try {
      await onConfirm(parsed);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form
        className={form.form}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-value`}>
            {label}
          </label>
          <input
            id={`${uid}-value`}
            className={form.input}
            inputMode="decimal"
            autoFocus
            value={text}
            aria-invalid={invalid}
            aria-describedby={hint ? `${uid}-hint` : undefined}
            onChange={(e) => setText(e.target.value)}
          />
          {suffix && <span className={form.hint}>{suffix}</span>}
          {hint && (
            <span id={`${uid}-hint`} className={form.hint}>
              {hint}
            </span>
          )}
          {invalid && (
            <span role="alert" className={form.hint}>
              Informe um número{max !== undefined ? ` entre ${min} e ${max}` : ` maior ou igual a ${min}`}.
            </span>
          )}
        </div>
        <div className={form.actions}>
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={invalid || busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
