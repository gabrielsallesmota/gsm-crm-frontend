import { useState, type FormEvent } from "react";
import { Button } from "../common/Button";
import styles from "./ChangePasswordForm.module.css";

const MIN_PASSWORD_LENGTH = 8;

interface ChangePasswordFormValues {
  currentPassword?: string;
  newPassword: string;
}

interface ChangePasswordFormProps {
  /** "change" pede a senha atual também; "reset" (via link de e-mail) não. */
  mode: "change" | "reset";
  loading: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (values: ChangePasswordFormValues) => void;
}

export function ChangePasswordForm({ mode, loading, error, submitLabel, onSubmit }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("As senhas não coincidem.");
      return;
    }
    setLocalError(null);
    onSubmit(mode === "change" ? { currentPassword, newPassword } : { newPassword });
  }

  return (
    <form onSubmit={handleSubmit}>
      {mode === "change" && (
        <>
          <label className={styles.label}>Senha atual</label>
          <input
            className={styles.input}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </>
      )}

      <label className={styles.label}>Nova senha</label>
      <input
        className={styles.input}
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        minLength={MIN_PASSWORD_LENGTH}
      />

      <label className={styles.label}>Confirmar nova senha</label>
      <input
        className={styles.input}
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={MIN_PASSWORD_LENGTH}
      />

      {(localError ?? error) && <div className={styles.error}>{localError ?? error}</div>}

      <Button type="submit" variant="primary" disabled={loading} className={styles.submitBtn}>
        {loading ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}
