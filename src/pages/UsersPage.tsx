import { useState } from "react";
import { useUsers } from "../hooks/useUsers";
import { usersService } from "../services/UsersService";
import { EmptyState } from "../components/common/EmptyState";
import { Avatar } from "../components/common/Avatar";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { useToast } from "../hooks/useToast";
import type { UserRole } from "../types/user";
import styles from "./UsersPage.module.css";

const ROLE_BADGE: Record<UserRole, { label: string; color: string; bg: string }> = {
  admin: { label: "Admin", color: "#2ee66e", bg: "rgba(46,230,110,.14)" },
  gestor: { label: "Gestor", color: "#a78bfa", bg: "rgba(167,139,250,.16)" },
  vendedor: { label: "Vendedor", color: "#4aa3ff", bg: "rgba(74,163,255,.14)" },
};

const MIN_PASSWORD_LENGTH = 8;

export function UsersPage() {
  const { data, loading, error, reload } = useUsers();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("vendedor");
  const [submitting, setSubmitting] = useState(false);

  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;

  async function handleCreate() {
    if (!name.trim() || !email.trim() || !passwordValid) return;
    setSubmitting(true);
    try {
      await usersService.create({ name, email, role, team: team || "—", password });
      toast(`Usuário adicionado — compartilhe a senha temporária "${password}" com ${name} por um canal seguro.`);
      setName("");
      setEmail("");
      setTeam("");
      setPassword("");
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Usuários</h1>
      <p className={styles.pageSubtitle}>Equipe com acesso ao CRM</p>

      <div className={styles.form}>
        <input className={styles.input} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={styles.input} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={styles.input} placeholder="Time" value={team} onChange={(e) => setTeam(e.target.value)} />
        <input
          className={styles.input}
          type="text"
          placeholder="Senha temporária (mín. 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="vendedor">Vendedor</option>
          <option value="gestor">Gestor</option>
          <option value="admin">Admin</option>
        </select>
        <Button
          variant="primary"
          onClick={() => void handleCreate()}
          disabled={submitting || !name.trim() || !email.trim() || !passwordValid}
        >
          Adicionar
        </Button>
      </div>
      <p className={styles.hint}>
        O backend não tem convite por e-mail nem reset de senha ainda — defina uma senha temporária aqui e
        compartilhe com a pessoa por um canal seguro (ela poderá trocá-la depois que essa funcionalidade existir).
      </p>

      {error && <EmptyState title="Não foi possível carregar os usuários" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <div className={styles.list}>
          {data.map((user) => {
            const badge = ROLE_BADGE[user.role];
            return (
              <div key={user.id} className={styles.row}>
                <Avatar name={user.name} bg={user.bg} color={user.color} />
                <div className={styles.info}>
                  <div className={styles.name}>{user.name}</div>
                  <div className={styles.email}>{user.email}</div>
                </div>
                <span className={styles.team}>{user.team}</span>
                <Badge label={badge.label} color={badge.color} bg={badge.bg} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
