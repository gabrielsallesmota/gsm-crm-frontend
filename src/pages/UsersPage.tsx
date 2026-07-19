import { useState } from "react";
import { useUsers } from "../hooks/useUsers";
import { usersService } from "../services/UsersService";
import { EmptyState } from "../components/common/EmptyState";
import { Avatar } from "../components/common/Avatar";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { useToast } from "../hooks/useToast";
import styles from "./UsersPage.module.css";

export function UsersPage() {
  const { data, loading, error, reload } = useUsers();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("");
  const [role, setRole] = useState<"admin" | "vendedor">("vendedor");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      await usersService.create({ name, email, role, team: team || "—" });
      toast("Usuário adicionado");
      setName("");
      setEmail("");
      setTeam("");
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
        <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as "admin" | "vendedor")}>
          <option value="vendedor">Vendedor</option>
          <option value="admin">Admin</option>
        </select>
        <Button variant="primary" onClick={() => void handleCreate()} disabled={submitting || !name.trim() || !email.trim()}>
          Adicionar
        </Button>
      </div>

      {error && <EmptyState title="Não foi possível carregar os usuários" message={error.message} />}
      {loading && !data && <div className={styles.loading}>Carregando…</div>}

      {data && (
        <div className={styles.list}>
          {data.map((user) => (
            <div key={user.id} className={styles.row}>
              <Avatar name={user.name} bg={user.bg} color={user.color} />
              <div className={styles.info}>
                <div className={styles.name}>{user.name}</div>
                <div className={styles.email}>{user.email}</div>
              </div>
              <span className={styles.team}>{user.team}</span>
              <Badge
                label={user.role === "admin" ? "Admin" : "Vendedor"}
                color={user.role === "admin" ? "#2ee66e" : "#4aa3ff"}
                bg={user.role === "admin" ? "rgba(46,230,110,.14)" : "rgba(74,163,255,.14)"}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
