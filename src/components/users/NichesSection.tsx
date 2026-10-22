import { useState } from "react";
import { useToast } from "../../hooks/useToast";
import { leadServicesService } from "../../services/LeadServicesService";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { EmptyState } from "../common/EmptyState";
import { SettingsCard } from "../settings/SettingsCard";
import type { LeadService } from "../../types/leadService";
import type { User } from "../../types/user";
import styles from "../settings/Settings.module.css";

/**
 * Nichos (serviços que a empresa vende). Cria-se o nicho aqui e cada pessoa recebe os nichos dela
 * no convite ou em "Nichos" na linha da pessoa. Lead que chega pela integração entra no nicho, sem
 * dono: os vendedores daquele nicho recebem o aviso no WhatsApp e veem o lead na fila. Se o
 * serviço do lead não bater com nenhum, vale o nicho padrão.
 */
export function NichesSection({
  services,
  error,
  reload,
  users,
  canManage,
}: {
  services: LeadService[] | null;
  error: Error | null;
  reload: () => void;
  users: User[];
  canManage: boolean;
}) {
  const { toast, toastError } = useToast();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeadService | null>(null);

  const byId = new Map(users.map((u) => [u.id, u]));
  const hasDefault = services?.some((s) => s.isDefault && s.active) ?? false;

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await leadServicesService.create({ name, isDefault: !services?.length });
      setNewName("");
      toast("Nicho criado");
      reload();
    } catch (err) {
      toastError(err, "Não foi possível criar o nicho");
    }
  }

  async function patch(service: LeadService, input: { active?: boolean; isDefault?: boolean }, done: string) {
    setBusy(service.id);
    try {
      await leadServicesService.update(service.id, input);
      toast(done);
      reload();
    } catch (err) {
      toastError(err, "Não foi possível salvar o nicho");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(service: LeadService): Promise<boolean> {
    try {
      await leadServicesService.delete(service.id);
      toast("Nicho excluído");
      reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível excluir o nicho");
      return false;
    }
  }

  return (
    <SettingsCard
      title="Nichos"
      description="Os serviços que vocês vendem (ex.: Seguro Auto, Implante, Landing page). Cada vendedor atende um ou mais nichos: recebe o aviso dos leads novos do nicho e vê a fila deles no pipeline. Se o serviço do lead não bater com nenhum nicho, vale o padrão."
      {...(canManage
        ? {
            actions: (
              <div className={styles.inlineForm}>
                <input
                  className={styles.input}
                  placeholder="Nome do nicho (ex.: Seguro Auto)…"
                  aria-label="Nome do novo nicho"
                  value={newName}
                  maxLength={80}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
                />
                <Button variant="primary" onClick={() => void handleCreate()} disabled={!newName.trim()}>
                  Adicionar
                </Button>
              </div>
            ),
          }
        : {})}
    >
      {error && (
        <EmptyState
          tone="error"
          title="Não foi possível carregar os nichos"
          message={error.message}
          actions={[{ label: "Tentar de novo", onClick: reload }]}
        />
      )}
      {services && services.length === 0 && (
        <p className={styles.help}>
          Nenhum nicho ainda. Crie os nichos primeiro e depois marque, em cada pessoa, quais ela atende.
        </p>
      )}
      {services && services.length > 0 && !hasDefault && (
        <p className={styles.warning}>
          Nenhum nicho ativo está marcado como padrão: leads com serviço desconhecido ficam sem nicho e só gestores os veem.
        </p>
      )}

      <div className={styles.routingList}>
        {services?.map((service) => {
          const disabled = busy === service.id;
          const members = service.memberUserIds.map((id) => byId.get(id)).filter((u): u is User => Boolean(u));
          return (
            <section key={service.id} className={styles.pipelineCard} aria-label={`Nicho ${service.name}`}>
              <div className={styles.routingHead}>
                <div>
                  <strong>{service.name}</strong>
                  {service.isDefault && <span className={styles.routingTag}>Padrão</span>}
                  {!service.active && <span className={styles.routingTagMuted}>Desativado</span>}
                  <div className={styles.help}>
                    Chave para a integração: <code>{service.key}</code>
                  </div>
                </div>
                {canManage && (
                  <div className={styles.routingActions}>
                    {!service.isDefault && (
                      <button
                        type="button"
                        className={styles.rowBtn}
                        disabled={disabled}
                        onClick={() => void patch(service, { isDefault: true }, "Nicho padrão atualizado")}
                      >
                        Tornar padrão
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.rowBtn}
                      disabled={disabled}
                      onClick={() =>
                        void patch(
                          service,
                          { active: !service.active },
                          service.active ? "Nicho desativado" : "Nicho reativado",
                        )
                      }
                    >
                      {service.active ? "Desativar" : "Reativar"}
                    </button>
                    <button
                      type="button"
                      className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                      disabled={disabled}
                      onClick={() => setConfirmDelete(service)}
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.routingMembers}>
                {members.length === 0 ? (
                  <p className={styles.help}>Ninguém atende este nicho ainda.</p>
                ) : (
                  members.map((user) => (
                    <div key={user.id} className={styles.routingMember}>
                      <span>{user.name}</span>
                      {!user.phone && <span className={styles.routingNoPhone}>sem telefone, não recebe o aviso</span>}
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Excluir nicho?"
          message={`"${confirmDelete.name}" deixa de existir. Leads novos desse serviço passam a cair no nicho padrão, e os leads que estão na fila dele ficam sem nicho.`}
          confirmLabel="Excluir"
          onConfirm={() => handleDelete(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </SettingsCard>
  );
}
