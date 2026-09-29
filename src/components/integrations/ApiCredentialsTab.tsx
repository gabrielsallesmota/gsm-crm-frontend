import { useState } from "react";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import form from "../common/Form.module.css";
import { useApiCredentials } from "../../hooks/useIntegrations";
import { useToast } from "../../hooks/useToast";
import { integrationsService } from "../../services/IntegrationsService";
import type { ApiCredential, ApiScopeDefinition } from "../../types/integrations";
import { formatDateTime } from "../../utils/datetime";
import {
  canManageCredential,
  credentialState,
  EXPIRATION_OPTIONS,
  expirationToIso,
  GRACE_OPTIONS,
  toggleItem,
  validateCredentialDraft,
  type ExpirationChoice,
} from "../../utils/integrations";
import { SecretReveal } from "./SecretReveal";
import styles from "./Integrations.module.css";

interface Revealed {
  title: string;
  secret: string;
}

/** Configurações → Integrações → API. `canManageSecrets=false` durante
 * sessão de suporte: a GSM vê, mas não cria/rotaciona/revoga credenciais
 * do cliente (o backend também recusa). */
export function ApiCredentialsTab({ canManageSecrets }: { canManageSecrets: boolean }) {
  const { data, loading, error, notImplemented, reload } = useApiCredentials();
  const { toast, toastError } = useToast();
  const [creating, setCreating] = useState(false);
  const [rotating, setRotating] = useState<ApiCredential | null>(null);
  const [revoking, setRevoking] = useState<ApiCredential | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);

  if (notImplemented) {
    return <p className={styles.empty}>Integrações não estão disponíveis na demonstração.</p>;
  }
  if (loading && !data) return <SkeletonRows rows={3} label="Carregando credenciais" />;
  if (error) {
    return (
      <EmptyState
        tone="error"
        title="Não foi possível carregar as credenciais"
        message={error.message}
        actions={[{ label: "Tentar de novo", onClick: reload }]}
      />
    );
  }
  const credentials = data?.credentials ?? [];
  const scopes = data?.scopes ?? [];
  const scopeLabel = new Map(scopes.map((s) => [s.scope, s.label]));

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.intro}>
          Credenciais para o n8n, landing pages, site ou outro sistema enviarem leads ao CRM. Cada
          credencial pertence a esta organização e só faz o que as permissões escolhidas permitem.
          Envie no header <code>X-API-Key</code>.
        </p>
        {canManageSecrets && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Nova credencial
          </Button>
        )}
      </div>

      <div className={styles.tableWrap}>
        {credentials.length === 0 ? (
          <EmptyState
            compact
            title="Nenhuma credencial criada ainda"
            message="Crie uma credencial para cada sistema que vai enviar leads (ex.: uma para o n8n, outra para o site). Assim você pode revogar uma sem afetar as outras."
            actions={
              canManageSecrets ? [{ label: "Nova credencial", onClick: () => setCreating(true) }] : []
            }
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome / Client ID</th>
                <th>Permissões</th>
                <th>Status</th>
                <th>Último uso</th>
                <th>Expira</th>
                {canManageSecrets && <th />}
              </tr>
            </thead>
            <tbody>
              {credentials.map((c) => {
                const state = credentialState(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <div>{c.name}</div>
                      <div className={`${styles.mono} ${styles.muted}`}>{c.clientId}</div>
                    </td>
                    <td>
                      <div className={styles.chips}>
                        {c.scopes.map((s) => (
                          <span key={s} className={styles.chip} title={scopeLabel.get(s) ?? s}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.pill} ${styles[state.tone]}`}>{state.label}</span>
                      {c.previousSecretValidUntil && (
                        <div className={styles.muted}>
                          Secret anterior vale até {formatDateTime(c.previousSecretValidUntil)}
                        </div>
                      )}
                    </td>
                    <td>
                      {c.lastUsedAt ? formatDateTime(c.lastUsedAt) : "Nunca usada"}
                      {c.lastUsedIp && <div className={styles.muted}>IP {c.lastUsedIp}</div>}
                    </td>
                    <td>{c.expiresAt ? formatDateTime(c.expiresAt) : "Não expira"}</td>
                    {canManageSecrets && (
                      <td>
                        {canManageCredential(c) && (
                          <div className={styles.rowActions}>
                            <Button onClick={() => setRotating(c)}>Rotacionar</Button>
                            <Button variant="danger" onClick={() => setRevoking(c)}>
                              Revogar
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <CreateCredentialModal
          scopes={scopes}
          onClose={() => setCreating(false)}
          onCreated={(fullKey) => {
            setCreating(false);
            setRevealed({ title: "Credencial criada", secret: fullKey });
            reload();
          }}
        />
      )}
      {rotating && (
        <RotateCredentialModal
          credential={rotating}
          onClose={() => setRotating(null)}
          onRotated={(fullKey) => {
            setRotating(null);
            setRevealed({ title: "Novo secret gerado", secret: fullKey });
            reload();
          }}
        />
      )}
      {revoking && (
        <ConfirmDialog
          title="Revogar credencial"
          message={`"${revoking.name}" deixa de funcionar imediatamente (inclusive um secret anterior em rotação). Integrações que a usam passam a receber 401. Não é possível desfazer.`}
          confirmLabel="Revogar"
          onClose={() => setRevoking(null)}
          onConfirm={async () => {
            try {
              await integrationsService.revokeCredential(revoking.id);
              toast("Credencial revogada.");
              reload();
              return true;
            } catch (err) {
              toastError(err, "Não foi possível revogar a credencial.");
              return false;
            }
          }}
        />
      )}
      {revealed && (
        <SecretReveal
          title={revealed.title}
          label="Credencial (X-API-Key)"
          secret={revealed.secret}
          extra="Formato client_id.secret — envie o valor inteiro no header X-API-Key."
          onClose={() => setRevealed(null)}
        />
      )}
    </>
  );
}

function CreateCredentialModal({
  scopes,
  onClose,
  onCreated,
}: {
  scopes: ApiScopeDefinition[];
  onClose: () => void;
  onCreated: (fullKey: string) => void;
}) {
  const { toastError } = useToast();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>(["leads:create"]);
  const [expiration, setExpiration] = useState<ExpirationChoice>("365");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    const invalid = validateCredentialDraft(name, selected);
    setProblem(invalid);
    if (invalid) return;
    setBusy(true);
    try {
      const created = await integrationsService.createCredential({
        name,
        scopes: selected,
        expiresAt: expirationToIso(expiration),
      });
      onCreated(created.fullKey);
    } catch (err) {
      toastError(err, "Não foi possível criar a credencial.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nova credencial de API"
      subtitle="Dê só as permissões que a integração realmente precisa."
      onClose={busy ? () => undefined : onClose}
    >
      <div className={form.form}>
        <label className={form.field}>
          <span className={form.label}>Nome</span>
          <input
            className={form.input}
            value={name}
            maxLength={200}
            placeholder="Ex.: n8n — Instagram"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className={form.field}>
          <span className={form.label}>Permissões</span>
          <div className={styles.checkList}>
            {scopes.map((s) => (
              <label key={s.scope} className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={selected.includes(s.scope)}
                  onChange={() => setSelected((cur) => toggleItem(cur, s.scope))}
                />
                <span>
                  <strong className={styles.mono}>{s.scope}</strong> — {s.label}
                  <div className={styles.muted}>{s.endpoints.join(" · ")}</div>
                </span>
              </label>
            ))}
          </div>
        </div>
        <label className={form.field}>
          <span className={form.label}>Expiração</span>
          <select
            className={form.select}
            value={expiration}
            onChange={(e) => setExpiration(e.target.value as ExpirationChoice)}
          >
            {EXPIRATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {problem && <p className={form.error}>{problem}</p>}
        <div className={form.actions}>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "Criando…" : "Criar credencial"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RotateCredentialModal({
  credential,
  onClose,
  onRotated,
}: {
  credential: ApiCredential;
  onClose: () => void;
  onRotated: (fullKey: string) => void;
}) {
  const { toastError } = useToast();
  const [grace, setGrace] = useState(24);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const rotated = await integrationsService.rotateCredential(credential.id, grace);
      onRotated(rotated.fullKey);
    } catch (err) {
      toastError(err, "Não foi possível rotacionar a credencial.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Rotacionar "${credential.name}"`}
      subtitle="Gera um novo secret. O Client ID continua o mesmo; o secret antigo nunca pode ser recuperado."
      onClose={busy ? () => undefined : onClose}
    >
      <div className={form.form}>
        <label className={form.field}>
          <span className={form.label}>Secret atual</span>
          <select
            className={form.select}
            value={grace}
            onChange={(e) => setGrace(Number(e.target.value))}
          >
            {GRACE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className={form.hint}>
            A janela permite trocar a credencial no n8n/sistema sem derrubar a integração.
          </span>
        </label>
        <div className={form.actions}>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "Gerando…" : "Gerar novo secret"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
