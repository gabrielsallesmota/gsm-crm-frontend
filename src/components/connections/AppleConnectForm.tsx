import { useId, useState, type FormEvent } from "react";
import { Button } from "../common/Button";
import { useToast } from "../../hooks/useToast";
import { connectionsService } from "../../services/ConnectionsService";
import { describeConnectionError, isAppPassword } from "../../utils/connections";
import type { Connection } from "../../types/connections";
import form from "../common/Form.module.css";
import styles from "./Connections.module.css";

/**
 * Conectar (ou reconectar) a agenda do iCloud. A Apple não tem a tela de
 * "autorizar" do Google/Microsoft: a pessoa gera uma SENHA DE APP na conta Apple
 * e cola aqui. A senha vai uma única vez ao backend (que confere no iCloud e guarda
 * cifrada) e some do formulário logo depois — nunca é exibida de volta.
 */
export function AppleConnectForm({
  initialAppleId = "",
  disabled,
  onConnected,
  onCancel,
}: {
  initialAppleId?: string;
  disabled: boolean;
  onConnected: (c: Connection) => void;
  onCancel?: () => void;
}) {
  const { toast } = useToast();
  const id = useId();
  const [appleId, setAppleId] = useState(initialAppleId);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordLooksRight = isAppPassword(password);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!appleId.trim() || !passwordLooksRight) return;
    setBusy(true);
    setError(null);
    try {
      const connection = await connectionsService.connectWithPassword("apple", appleId.trim(), password);
      setPassword("");
      onConnected(connection);
      toast("Agenda da Apple conectada. Agora escolha quais calendários sincronizar.");
    } catch (err) {
      setPassword("");
      setError(describeConnectionError(err, "Não foi possível conectar a agenda da Apple."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.appleForm} onSubmit={(e) => void submit(e)} noValidate>
      <ol className={styles.steps}>
        <li>
          Entre em{" "}
          <a href="https://account.apple.com/account/manage" target="_blank" rel="noopener noreferrer">
            account.apple.com
          </a>{" "}
          → <strong>Iniciar sessão e segurança</strong> → <strong>Senhas de app</strong> (exige a
          verificação em duas etapas ligada).
        </li>
        <li>Crie uma senha com o nome “GSM CRM” e copie o código no formato xxxx-xxxx-xxxx-xxxx.</li>
        <li>Cole abaixo junto com o seu Apple ID. Nunca use a senha principal da sua conta Apple.</li>
      </ol>
      <p className={styles.muted} role="note">
        <strong>O que essa senha libera:</strong> a Apple não deixa limitar uma senha de app só à agenda — ela também
        abre o e-mail e os contatos do iCloud. O GSM CRM usa apenas a agenda e guarda a senha cifrada. Crie uma senha só
        para o GSM CRM: para cortar o acesso a qualquer momento, apague-a em <strong>Senhas de app</strong> na sua conta
        Apple (desconectar aqui apaga a cópia do CRM, mas não revoga a senha na Apple).
      </p>
      <div className={form.field}>
        <label className={form.label} htmlFor={`${id}-user`}>Apple ID (e-mail)</label>
        <input
          className={form.input}
          id={`${id}-user`}
          type="email"
          autoComplete="username"
          value={appleId}
          maxLength={320}
          onChange={(e) => setAppleId(e.target.value)}
          disabled={disabled || busy}
          required
        />
      </div>
      <div className={form.field}>
        <label className={form.label} htmlFor={`${id}-pass`}>Senha de app</label>
        <input
          className={form.input}
          id={`${id}-pass`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="xxxx-xxxx-xxxx-xxxx"
          value={password}
          maxLength={40}
          onChange={(e) => setPassword(e.target.value)}
          disabled={disabled || busy}
          aria-describedby={`${id}-hint`}
          aria-invalid={password.length > 0 && !passwordLooksRight}
          required
        />
        <span id={`${id}-hint`} className={styles.muted}>
          {password.length > 0 && !passwordLooksRight
            ? "Isso não parece uma senha de app: são 16 letras, no formato xxxx-xxxx-xxxx-xxxx."
            : "Só a agenda é sincronizada. Os Lembretes da Apple não têm acesso por API."}
        </span>
      </div>
      {error && (
        <p className={`${styles.alert} ${styles.alertBad}`} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        {onCancel && (
          <Button type="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={disabled || busy || !appleId.trim() || !passwordLooksRight}
        >
          {busy ? "Conferindo no iCloud…" : "Conectar agenda da Apple"}
        </Button>
      </div>
    </form>
  );
}
