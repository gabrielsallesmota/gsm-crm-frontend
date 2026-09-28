import { useState } from "react";
import { useUsers } from "../hooks/useUsers";
import { useUserActions } from "../hooks/useUserActions";
import { EmptyState } from "../components/common/EmptyState";
import { Avatar } from "../components/common/Avatar";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { Modal } from "../components/common/Modal";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";
import { can } from "../auth/permissions";
import type { User, UserRole } from "../types/user";
import styles from "./UsersPage.module.css";
import form from "../components/common/Form.module.css";

const ROLE_BADGE: Record<UserRole, { label: string; color: string; bg: string }> = {
  admin: { label: "Admin", color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  gestor: { label: "Gestor", color: "var(--tone-purple)", bg: "var(--tone-purple-bg)" },
  vendedor: { label: "Vendedor", color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
};

const PENDING_BADGE = { label: "Convite pendente", color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" };
const SUSPENDED_BADGE = { label: "Desativado", color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" };

const MIN_PASSWORD_LENGTH = 8;

/**
 * Equipe do tenant (Etapa 1). Admin convida (e-mail com link de primeiro
 * acesso — padrão; senha temporária só como alternativa, e NUNCA exibida de
 * volta), troca papel, desativa/reativa e reenvia convite. Gestor só vê.
 * Os papéis possíveis são só os do tenant — não existe caminho para criar
 * "platform staff" aqui (o backend também recusa).
 */
export function UsersPage() {
  const { data, loading, error, reload } = useUsers();
  const { update, resendInvitation } = useUserActions();
  const { toast, toastError } = useToast();
  const { user: currentUser } = useAuth();
  // Gerenciar equipe é só ADMIN no backend (gestor só lista).
  const canManage = can(currentUser, "users.create");
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<User | null>(null);

  async function handleRole(member: User, role: UserRole) {
    if (role === member.role) return;
    setBusyId(member.id);
    try {
      await update(member.id, { role });
      toast(`${member.name} agora é ${ROLE_BADGE[role].label}`);
      reload();
    } catch (err) {
      toastError(err, "Não foi possível alterar o papel.");
    } finally {
      setBusyId(null);
    }
  }

  async function setActive(member: User, active: boolean): Promise<boolean> {
    setBusyId(member.id);
    try {
      await update(member.id, { active });
      toast(active ? `${member.name} foi reativado` : `${member.name} foi desativado`);
      reload();
      return true;
    } catch (err) {
      toastError(err, active ? "Não foi possível reativar." : "Não foi possível desativar.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleResend(member: User) {
    setBusyId(member.id);
    try {
      const sent = await resendInvitation(member.id);
      if (sent) toast(`Convite reenviado para ${member.email}`);
      else toast("Não foi possível enviar o e-mail agora. Tente de novo em instantes.", "warning");
    } catch (err) {
      toastError(err, "Não foi possível reenviar o convite.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Usuários</h1>
          <p className={styles.pageSubtitle}>
            Equipe com acesso ao CRM{canManage ? "" : " (somente leitura — só administradores gerenciam)"}
          </p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setInviting(true)}>
            + Convidar usuário
          </Button>
        )}
      </div>

      {error && (
        <EmptyState
          title="Não foi possível carregar os usuários"
          message={error.message}
          action={{ label: "Tentar de novo", onClick: reload }}
        />
      )}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <div className={styles.list}>
          {data.length === 0 && <div className={styles.loading}>Nenhum usuário.</div>}
          {data.map((member) => {
            const isSelf = member.id === currentUser?.id;
            const suspended = member.status === "suspended";
            const busy = busyId === member.id;
            return (
              <div key={member.id} className={suspended ? `${styles.row} ${styles.rowMuted}` : styles.row}>
                <Avatar name={member.name} bg={member.bg} color={member.color} />
                <div className={styles.info}>
                  <div className={styles.name}>
                    {member.name}
                    {isSelf ? " (você)" : ""}
                  </div>
                  <div className={styles.email}>{member.email}</div>
                </div>
                <div className={styles.badges}>
                  {suspended && <Badge {...SUSPENDED_BADGE} />}
                  {!suspended && member.pendingFirstAccess && <Badge {...PENDING_BADGE} />}
                </div>
                {canManage && !isSelf ? (
                  <div className={styles.actions}>
                    <select
                      className={styles.select}
                      value={member.role}
                      disabled={busy || suspended}
                      onChange={(e) => void handleRole(member, e.target.value as UserRole)}
                      aria-label={`Papel de ${member.name}`}
                    >
                      <option value="vendedor">Vendedor</option>
                      <option value="gestor">Gestor</option>
                      <option value="admin">Admin</option>
                    </select>
                    {member.pendingFirstAccess && !suspended && (
                      <Button onClick={() => void handleResend(member)} disabled={busy}>
                        Reenviar convite
                      </Button>
                    )}
                    {suspended ? (
                      <Button onClick={() => void setActive(member, true)} disabled={busy}>
                        Reativar
                      </Button>
                    ) : (
                      <Button variant="danger" onClick={() => setConfirmSuspend(member)} disabled={busy}>
                        Desativar
                      </Button>
                    )}
                  </div>
                ) : (
                  <Badge {...ROLE_BADGE[member.role]} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {inviting && <InviteModal onClose={() => setInviting(false)} onInvited={reload} />}
      {confirmSuspend && (
        <ConfirmDialog
          title="Desativar usuário?"
          message={`${confirmSuspend.name} perde o acesso imediatamente (as sessões abertas são encerradas). Os leads dele continuam no CRM e podem ser reatribuídos. Dá para reativar depois.`}
          confirmLabel="Desativar"
          onConfirm={() => setActive(confirmSuspend, false)}
          onClose={() => setConfirmSuspend(null)}
        />
      )}
    </div>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const { create } = useUserActions();
  const { toast, toastError } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("vendedor");
  const [useTempPassword, setUseTempPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordOk = !useTempPassword || password.length >= MIN_PASSWORD_LENGTH;
  const valid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim()) && passwordOk;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      const result = await create({
        name: name.trim(),
        email: email.trim(),
        role,
        ...(useTempPassword ? { password } : {}),
      });
      if (result.invitationSent === true) {
        toast(`Convite enviado para ${email.trim()} — o link vale por 72 horas.`);
      } else if (result.invitationSent === false) {
        toast(
          "Usuário criado, mas o e-mail de convite não foi enviado. Use \"Reenviar convite\" na lista.",
          "warning",
        );
      } else {
        // A senha NÃO é repetida no aviso (ficaria exposta na tela/print).
        toast(
          `Usuário criado. Envie a senha temporária para ${name.trim()} por um canal seguro — ela será trocada no primeiro acesso.`,
        );
      }
      onInvited();
      onClose();
    } catch (err) {
      toastError(err, "Não foi possível adicionar o usuário.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Convidar usuário"
      subtitle="A pessoa recebe um e-mail com um link para criar a própria senha."
      onClose={onClose}
    >
      <form className={form.form} onSubmit={(e) => void handleSubmit(e)} autoComplete="off">
        <label className={form.field}>
          <span className={form.label}>Nome</span>
          <input className={form.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className={form.field}>
          <span className={form.label}>E-mail</span>
          <input
            className={form.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className={form.field}>
          <span className={form.label}>Papel</span>
          <select className={form.select} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="vendedor">Vendedor — vê e trabalha só os próprios leads</option>
            <option value="gestor">Gestor — vê toda a equipe, configura o funil</option>
            <option value="admin">Admin — tudo, inclusive usuários</option>
          </select>
        </label>
        <label className={form.hint} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={useTempPassword}
            onChange={(e) => setUseTempPassword(e.target.checked)}
          />
          Sem e-mail? Definir uma senha temporária (troca obrigatória no 1º acesso)
        </label>
        {useTempPassword && (
          <label className={form.field}>
            <span className={form.label}>Senha temporária</span>
            <input
              className={form.input}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            />
          </label>
        )}
        <div className={form.actions}>
          <Button type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={!valid || submitting}>
            {submitting ? "Enviando…" : useTempPassword ? "Criar usuário" : "Enviar convite"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
