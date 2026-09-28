import { useState } from "react";
import { useProspects } from "../../hooks/useProspects";
import { useProspectStages } from "../../hooks/useProspectStages";
import { useMessageTemplates } from "../../hooks/useMessageTemplates";
import { useProspectLossReasons } from "../../hooks/useProspectLossReasons";
import { ProspectDrawer } from "./ProspectDrawer";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/EmptyState";
import styles from "../../pages/LeadsPage.module.css";

const ATIVO_BADGE = { label: "Ativo", color: "var(--tone-purple)", bg: "var(--tone-purple-bg)" };

/** Espelha `LeadsTable` acima só que pra Prospecção (carteira comercial
 * ativa da própria GSM) — mesma dado que já aparece no board de
 * `PipelinePage.tsx`, só que como lista/tabela (pedido explícito: "aba lead
 * deve aparecer tanto os prospecção quando contatos passivos"). Só
 * renderizada pra platform staff (ver filtro em `LeadsPage`). */
export function ProspectsTable() {
  const [search, setSearch] = useState("");
  const { data: stages } = useProspectStages();
  const { data: templates } = useMessageTemplates();
  const { data: lossReasons } = useProspectLossReasons();
  const { data, loading, error, reload } = useProspects({ search, page: 1, pageSize: 100 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const prospects = data?.items ?? [];
  const selected = prospects.find((p) => p.id === selectedId) ?? null;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            <Badge {...ATIVO_BADGE} /> Prospecção
          </h1>
          <p className={styles.pageSubtitle}>{data ? `${data.total} prospects` : "Carregando…"}</p>
        </div>
      </div>

      <input
        className={styles.search}
        placeholder="Buscar por empresa, cidade ou nicho…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <EmptyState title="Não foi possível carregar a prospecção" message={error.message} />}

      {!error && (
        <div className={styles.tableWrap}>
          <table className={styles.prospectTable}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Estágio</th>
                <th>Nicho</th>
                <th>Cidade</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((prospect) => {
                const stage = stages?.find((s) => s.id === prospect.stageId);
                return (
                  <tr
                    key={prospect.id}
                    className={styles.prospectRow}
                    onClick={() => setSelectedId(prospect.id)}
                  >
                    <td>{prospect.companyName}</td>
                    <td>
                      {stage && <Badge label={stage.name} color={stage.color} bg={`${stage.color}22`} />}
                    </td>
                    <td>{prospect.niche || "—"}</td>
                    <td>{prospect.city || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && prospects.length === 0 && (
            <div className={styles.empty}>Nenhum prospect encontrado.</div>
          )}
        </div>
      )}

      {selected && stages && (
        <ProspectDrawer
          prospect={selected}
          stages={stages}
          templates={templates ?? []}
          lossReasons={lossReasons ?? []}
          onClose={() => setSelectedId(null)}
          onSaved={() => reload()}
          onDeleted={() => {
            setSelectedId(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
