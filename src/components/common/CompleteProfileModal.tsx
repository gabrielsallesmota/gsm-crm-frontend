import { useState, type FormEvent } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { formatPhone } from "../../utils/phone";
import { needsProfileCompletion } from "../../utils/profile";
import { phoneError } from "../../utils/validation";
import { Button } from "./Button";
import form from "./Form.module.css";
import { Modal } from "./Modal";

export function CompleteProfileModal() {
  const { user, updateProfile, logout } = useAuth();
  const { toast, toastError } = useToast();
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!needsProfileCompletion(user)) return null;
  const problem = phoneError(phone, { required: true });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (problem) return;
    setBusy(true);
    try {
      await updateProfile({ phone });
      toast("Cadastro completo. Obrigado!");
    } catch (err) {
      toastError(err, "Não foi possível salvar o telefone.");
    } finally {
      setBusy(false);
    }
  }

  // sem como fechar: o modal some quando o telefone é salvo (ou a pessoa sai da conta)
  return (
    <Modal
      title="Complete seu cadastro"
      subtitle="Precisamos do seu telefone/WhatsApp para contato da equipe."
      onClose={() => undefined}
    >
      <form className={form.form} onSubmit={(e) => void submit(e)} autoComplete="off">
        <label className={form.field}>
          <span className={form.label}>
            Telefone / WhatsApp <span aria-hidden="true">*</span>
          </span>
          <input
            className={form.input}
            type="tel"
            inputMode="tel"
            required
            autoFocus
            placeholder="(11) 91234-5678"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && Boolean(problem)}
            aria-describedby={touched && problem ? "complete-phone-error" : undefined}
          />
          {touched && problem && (
            <span id="complete-phone-error" className={form.error}>
              {problem}
            </span>
          )}
        </label>
        <div className={form.actions}>
          <Button type="button" onClick={() => void logout()} disabled={busy}>
            Sair
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
