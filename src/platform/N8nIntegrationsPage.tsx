import { useState } from "react";
import { useN8nHistory, useN8nIntegrations } from "../hooks/usePlatform";
import { useToast } from "../hooks/useToast";
import { platformService } from "../services/PlatformService";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { formatDateTime } from "../utils/datetime";
import type { N8nEnvironment, N8nIntegration } from "../types/platform";
import { describeAuditAction, describeN8nChange } from "./provisioning";
import styles from "./Platform.module.css";

const ENVIRONMENTS: { value: N8nEnvironment; label: string }[] = [
  { value: "qa", label: "QA" },
  { value: "production", label: "Produção" },
];

const WORKFLOW_FILES: Record<string, string> = {
  new_lead: "gsm-novo-lead-nicho",
  daily_digest: "gsm-resumo-diario",
  weekly_report: "gsm-resumo-semanal",
  monthly_report: "gsm-resumo-mensal",
  follow_up_due: "gsm-followup-pendente",
  unassigned_lead: "gsm-lead-sem-responsavel",
  stalled_lead: "gsm-lead-parado",
};

/** Plataforma GSM → Integrações n8n: URL e liga/desliga de cada workflow por ambiente, teste
 * assinado (PING, sem enviar WhatsApp) e histórico. Vale na hora, sem reiniciar o servidor. */
export function N8nIntegrationsPage() {
  const [environment, setEnvironment] = useState<N8nEnvironment>("qa");
  const { data, loading, error, reload } = useN8nIntegrations(environment);
  const history = useN8nHistory();

  function refresh() {
    reload();
    history.reload();
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Integrações n8n</h1>
          <p className={styles.subtitle}>
            Um workflow por automação. O CRM decide quem recebe e o quê; o n8n só entrega.
          </p>
        </div>
        <div className={styles.toolbar} role="tablist" aria-label="Ambiente">
          {ENVIRONMENTS.map((env) => (
            <Button
              key={env.value}
              role="tab"
              aria-selected={environment === env.value}
              variant={environment === env.value ? "primary" : "ghost"}
              onClick={() => setEnvironment(env.value)}
            >
              {env.label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <EmptyState
          title="Não foi possível carregar as integrações"
          message={error.message}
          action={{ label: "Tentar de novo", onClick: reload }}
        />
      )}
      {loading && !data && <p className={styles.muted}>Carregando…</p>}

      {data && (
        <>
          <p className={styles.notice}>
            Este servidor usa o ambiente{" "}
            <strong>{data.activeEnvironment === "production" ? "Produção" : "QA"}</strong>.{" "}
            {data.activeEnvironment !== environment &&
              "As URLs abaixo só valem quando o backend do outro ambiente estiver no ar."}
          </p>
          {!data.signingSecretConfigured && (
            <p className={`${styles.notice} ${styles.danger}`}>
              N8N_OUTBOUND_SECRET não está definido no servidor: nada é enviado e o teste não pode ser
              assinado.
            </p>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Automação</th>
                  <th>URL do webhook</th>
                  <th>Ligado</th>
                  <th>Último teste</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <IntegrationRow
                    key={`${environment}:${item.workflow}`}
                    item={item}
                    production={environment === "production"}
                    canTest={data.signingSecretConfigured}
                    onChanged={refresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <section className={styles.panel} style={{ marginTop: 24 }}>
        <h2 className={styles.panelTitle}>Histórico</h2>
        {history.data && history.data.length === 0 && (
          <p className={styles.muted}>Nenhuma alteração ainda.</p>
        )}
        {history.data && history.data.length > 0 && (
          <table className={styles.table}>
            <tbody>
              {history.data.map((h) => (
                <tr key={`${h.at}:${h.action}`}>
                  <td>{formatDateTime(h.at)}</td>
                  <td>{describeAuditAction(h.action)}</td>
                  <td>{describeN8nChange(h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function IntegrationRow({
  item,
  production,
  canTest,
  onChanged,
}: {
  item: N8nIntegration;
  production: boolean;
  canTest: boolean;
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const [url, setUrl] = useState(item.url ?? "");
  const [enabled, setEnabled] = useState(item.enabled);
  const [busy, setBusy] = useState(false);
  const dirty = url.trim() !== (item.url ?? "") || enabled !== item.enabled;
  const file = WORKFLOW_FILES[item.workflow];

  async function save() {
    setBusy(true);
    try {
      await platformService.saveN8nIntegration(item.environment, item.workflow, {
        version: item.version,
        url: url.trim() || null,
        enabled,
      });
      toast(`${item.label}: salvo (vale na próxima execução, sem reiniciar)`);
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const result = await platformService.testN8nIntegration(item.environment, item.workflow);
      if (result.lastTestOk) toast(`${item.label}: o workflow respondeu (${result.lastTestDetail})`);
      else toastError(new Error(result.lastTestDetail ?? "sem resposta"), `${item.label}: falhou`);
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível testar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        <strong>{item.label}</strong>
        {file && <div className={styles.muted}>{file}.json</div>}
      </td>
      <td>
        <input
          className={styles.input}
          style={{ width: "100%", minWidth: 260 }}
          type="url"
          value={url}
          placeholder={production ? "https://… (obrigatório HTTPS)" : "https://…"}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
          aria-label={`URL do workflow ${item.label}`}
        />
      </td>
      <td>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={busy}
          aria-label={`Ligar ${item.label}`}
        />
      </td>
      <td>
        {item.lastTestAt ? (
          <span
            className={`${styles.pill} ${item.lastTestOk ? styles.pillActive : styles.pillSuspended}`}
            title={formatDateTime(item.lastTestAt)}
          >
            {item.lastTestOk ? "OK" : "Falhou"} · {item.lastTestDetail}
          </span>
        ) : (
          <span className={styles.muted}>—</span>
        )}
      </td>
      <td>
        <div className={styles.actions}>
          <Button onClick={() => void save()} disabled={busy || !dirty}>
            Salvar
          </Button>
          <Button onClick={() => void test()} disabled={busy || dirty || !item.url || !canTest}>
            Testar
          </Button>
        </div>
      </td>
    </tr>
  );
}
