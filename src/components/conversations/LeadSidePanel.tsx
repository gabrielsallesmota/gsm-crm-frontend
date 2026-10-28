import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { can } from "../../auth/permissions";
import { Button } from "../common/Button";
import { ROUTES } from "../../constants/routes";
import { useAuth } from "../../hooks/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePipelines } from "../../hooks/usePipelines";
import { useTeamDirectory } from "../../hooks/useTeamDirectory";
import { useToast } from "../../hooks/useToast";
import { leadsService } from "../../services/LeadsService";
import { conversationsService } from "../../services/MessagingService";
import type { Lead } from "../../types/lead";
import type { ConversationLead } from "../../utils/messaging";
import styles from "./Conversations.module.css";

/**
 * O lead da conversa, editado pelas rotas ATUAIS de leads (mesmas permissões, timeline e
 * auditoria): responsável (gestor/admin), etapa e atalho para a ficha (tags, notas, tarefas).
 * Contato sem número confirmado (só LID) ou sem lead pode ser vinculado à mão.
 */
export function LeadSidePanel({
  conversationId,
  lead,
  leadId,
  identityConfirmed,
  onClose,
  onChanged,
}: {
  conversationId: string;
  lead: ConversationLead | null;
  leadId: string | null;
  identityConfirmed: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const canAssign = can(user, "leads.assign");
  const team = useTeamDirectory();
  const pipelines = usePipelines();
  const { toast, toastError } = useToast();
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300);
  const [found, setFound] = useState<Lead[]>([]);

  useEffect(() => {
    if (!linking || q.length < 2) {
      setFound([]);
      return;
    }
    let alive = true;
    leadsService
      .list({ search: q, pageSize: 6 })
      .then((page) => alive && setFound(page.items))
      .catch(() => alive && setFound([]));
    return () => {
      alive = false;
    };
  }, [linking, q]);

  const stages = pipelines.data?.find((p) => p.id === lead?.pipeline?.id)?.stages ?? [];

  async function run(action: () => Promise<unknown>, done: string, fail: string) {
    setBusy(true);
    try {
      await action();
      toast(done);
      onChanged();
    } catch (err) {
      toastError(err, fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className={styles.sidePane} aria-label="Lead da conversa">
      <div className={styles.sideHeader}>
        <h3 className={styles.sideTitle}>Lead</h3>
        <button type="button" className={styles.linkish} onClick={onClose}>
          Fechar
        </button>
      </div>

      {lead ? (
        <>
          <p className={styles.sideName}>{lead.name}</p>
          <label className={styles.sideField}>
            <span>Responsável</span>
            {canAssign ? (
              <select
                value={lead.owner?.id ?? ""}
                disabled={busy}
                onChange={(e) =>
                  e.target.value &&
                  void run(
                    () => leadsService.update(lead.id, { ownerId: e.target.value }),
                    "Responsável atualizado.",
                    "Não foi possível trocar o responsável.",
                  )
                }
              >
                {!lead.owner && <option value="">Sem responsável (fila)</option>}
                {(team.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <strong>{lead.owner?.name ?? "Sem responsável (fila)"}</strong>
            )}
          </label>
          {!lead.owner && !canAssign && (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                void run(() => leadsService.claim(lead.id), "Lead vinculado a você.", "Outra pessoa já assumiu este lead.")
              }
            >
              Vincular a você
            </Button>
          )}
          <label className={styles.sideField}>
            <span>Etapa{lead.pipeline?.name ? ` · ${lead.pipeline.name}` : ""}</span>
            <select
              value={lead.stage?.id ?? ""}
              disabled={busy || stages.length === 0}
              onChange={(e) =>
                void run(
                  () => leadsService.move(lead.id, e.target.value),
                  "Etapa atualizada.",
                  "Não foi possível mudar a etapa.",
                )
              }
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <Link className={styles.headerLink} to={ROUTES.leadDetail(lead.id)}>
            Abrir ficha (tags, notas, tarefas)
          </Link>
        </>
      ) : leadId ? (
        <Link className={styles.headerLink} to={ROUTES.leadDetail(leadId)}>
          Abrir lead
        </Link>
      ) : (
        <p className={styles.muted}>Esta conversa ainda não tem lead.</p>
      )}

      {(!identityConfirmed || !lead) && (
        <div className={styles.linkBox}>
          {!identityConfirmed && (
            <p className={styles.muted}>
              O WhatsApp não informou o número deste contato. Se ele já é um lead, vincule para juntar o histórico.
            </p>
          )}
          {!linking ? (
            <button type="button" className={styles.linkish} onClick={() => setLinking(true)}>
              Vincular a outro lead
            </button>
          ) : (
            <>
              <input
                type="search"
                className={styles.search}
                placeholder="Nome, telefone ou e-mail do lead"
                aria-label="Buscar lead para vincular"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              <ul className={styles.foundList}>
                {found.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={styles.foundItem}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          async () => {
                            await conversationsService.linkLead(conversationId, l.id);
                            setLinking(false);
                          },
                          "Conversa vinculada ao lead.",
                          "Não foi possível vincular.",
                        )
                      }
                    >
                      {l.name}
                      {l.phone ? ` · ${l.phone}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
