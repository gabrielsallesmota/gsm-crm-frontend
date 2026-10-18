import { useState } from "react";
import type { CreateContractInput } from "../../types/client";
import { Button } from "../common/Button";
import { ContractCard } from "./ContractCard";
import { ContractForm } from "./ContractForm";
import { useClientActions } from "../../hooks/useClientActions";
import { useClientContracts } from "../../hooks/useClientContracts";
import { useRenewalDefault } from "../../hooks/useRenewalDefault";
import { useToast } from "../../hooks/useToast";
import styles from "./ClientDrawer.module.css";
import local from "./Contracts.module.css";

/**
 * Contratos do cliente (Cliente > Contratos > Parcelas). Um cliente pode ter vários — por exemplo
 * um consórcio que volta todo ano, cada ciclo com a própria renovação. Todos veem; só admin e
 * gestor criam e alteram.
 */
export function ContractsSection({
  clientId,
  canManage,
  onChanged,
}: {
  clientId: string;
  canManage: boolean;
  /** Algo mudou nos contratos/parcelas: a lista de clientes (próx. renovação/vencimento) recarrega. */
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const { createContract } = useClientActions();
  const { data: contracts, loading, error, reload } = useClientContracts(clientId);
  const tenantDefault = useRenewalDefault();
  const [creating, setCreating] = useState(false);

  function changed() {
    reload();
    onChanged();
  }

  async function create(input: CreateContractInput) {
    try {
      await createContract(clientId, input);
      toast("Contrato criado");
      setCreating(false);
      changed();
    } catch (err) {
      toastError(err, "Não foi possível criar o contrato");
    }
  }

  return (
    <section className={styles.section} aria-labelledby="client-contracts-title">
      <div className={styles.sectionHeaderRow}>
        <h3 id="client-contracts-title" className={styles.sectionTitle}>
          Contratos e renovação
        </h3>
        {canManage && !creating && <Button onClick={() => setCreating(true)}>+ Novo contrato</Button>}
      </div>

      {creating && (
        <ContractForm
          contract={null}
          tenantDefault={tenantDefault}
          submitLabel="Criar contrato"
          onCancel={() => setCreating(false)}
          onSubmit={create}
        />
      )}

      {error && (
        <p className={local.error} role="alert">
          Não foi possível carregar os contratos. {error.message}
        </p>
      )}
      {loading && !contracts && <p className={local.empty}>Carregando contratos…</p>}

      {contracts && contracts.length === 0 && !creating && (
        <p className={local.empty}>
          Nenhum contrato ainda.
          {canManage
            ? " Crie o primeiro para registrar valor, parcelas e a data de renovação."
            : " Quem gerencia os clientes pode cadastrá-lo."}
        </p>
      )}

      {contracts && contracts.length > 0 && (
        <ul className={local.list} aria-label="Contratos do cliente">
          {contracts.map((contract) => (
            <ContractCard
              key={contract.id}
              clientId={clientId}
              contract={contract}
              canManage={canManage}
              tenantDefault={tenantDefault}
              onChanged={changed}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
