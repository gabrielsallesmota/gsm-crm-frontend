import { useEffect, useState } from "react";
import type { ClientLink, FinAccount, FinProfile } from "../../types/finance";
import { Button } from "../common/Button";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { formatCents } from "../../utils/finance";
import styles from "./ClientDrawer.module.css";
import form from "../common/Form.module.css";

/**
 * Conta de recebimento do cliente (Financeiro). Vincular faz as parcelas do cliente aparecerem como
 * receita PREVISTA nessa conta (e como recebida quando a parcela é marcada como paga). Só o
 * proprietário do Financeiro enxerga: para qualquer outra pessoa o bloco simplesmente não aparece.
 */
export function ClientReceivingAccount({
  clientId,
  canManage,
}: {
  clientId: string;
  canManage: boolean;
}) {
  const { toast, toastError } = useToast();
  const [data, setData] = useState<{ accounts: FinAccount[]; profiles: FinProfile[] } | null>(null);
  const [link, setLink] = useState<ClientLink | null>(null);
  const [hidden, setHidden] = useState(false);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setHidden(false);
    Promise.all([
      financeService.listClientLinks(),
      financeService.listAccounts(),
      financeService.listProfiles(),
    ])
      .then(([links, accounts, profiles]) => {
        if (cancelled) return;
        const found = links.find((l) => l.clientId === clientId) ?? null;
        setLink(found);
        setData({ accounts: accounts.filter((a) => a.kind !== "cartao"), profiles });
        setSelected(found?.accountId ?? "");
      })
      .catch(() => {
        if (!cancelled) setHidden(true); // sem acesso ao Financeiro (ou indisponível)
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (hidden || data === null) return null;
  const { accounts, profiles } = data;
  const profileName = (id: string) => profiles.find((p) => p.id === id)?.name ?? "";
  const label = (a: FinAccount) =>
    `${profileName(a.profileId)} — ${a.name}${a.balanceCents === null ? "" : ` (${formatCents(a.balanceCents)})`}`;

  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await financeService.setClientLink(clientId, selected);
      setLink(result.link);
      const total = result.created + result.updated;
      toast(
        total > 0
          ? `Parcelas previstas na conta (${result.created} novas, ${result.updated} atualizadas)`
          : "Conta de recebimento definida",
      );
    } catch (err) {
      toastError(err, "Não foi possível vincular a conta");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      const removed = await financeService.removeClientLink(clientId);
      setLink(null);
      setSelected("");
      toast(removed > 0 ? `${removed} previsões retiradas do Financeiro` : "Conta desvinculada");
    } catch (err) {
      toastError(err, "Não foi possível desvincular");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby={`recv-${clientId}`}>
      <h3 id={`recv-${clientId}`} className={styles.sectionTitle}>
        Recebimento no Financeiro
      </h3>
      <div className={form.field}>
        <label className={form.label} htmlFor={`recv-acc-${clientId}`}>
          Conta de recebimento
        </label>
        <select
          id={`recv-acc-${clientId}`}
          className={form.select}
          value={selected}
          disabled={!canManage || busy}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Sem vínculo</option>
          {accounts
            .filter((a) => !a.archived || a.id === link?.accountId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {label(a)}
              </option>
            ))}
        </select>
        <span className={form.hint}>
          As parcelas deste cliente entram como receita prevista nessa conta e viram recebidas ao
          marcar a parcela como paga.
        </span>
      </div>
      {canManage && (
        <div className={form.actions}>
          {link && (
            <Button onClick={() => void unlink()} disabled={busy}>
              Desvincular
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={busy || !selected || selected === link?.accountId}
          >
            {link ? "Trocar conta" : "Vincular conta"}
          </Button>
        </div>
      )}
    </section>
  );
}
