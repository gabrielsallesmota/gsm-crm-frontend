import { useState } from "react";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import form from "../common/Form.module.css";
import { useWebhookDeliveries, useWebhookDelivery, useWebhooks } from "../../hooks/useIntegrations";
import { useToast } from "../../hooks/useToast";
import { integrationsService } from "../../services/IntegrationsService";
import type {
  WebhookEndpoint,
  WebhookEventDefinition,
  WebhookWithSecret,
} from "../../types/integrations";
import { formatDateTime } from "../../utils/datetime";
import {
  DELIVERY_STATUS_LABEL,
  deliveryStatusLabel,
  deliveryTone,
  describeAttempt,
  lastResultLabel,
  toggleItem,
  validateWebhookDraft,
  webhookState,
} from "../../utils/integrations";
import { SecretReveal } from "./SecretReveal";
import styles from "./Integrations.module.css";

/**
 * Configurações → Integrações → Webhooks. `canWrite=false` em suporte
 * somente leitura; `canManageSecrets=false` em QUALQUER sessão de suporte
 * (criar, excluir e rotacionar secret são bloqueados no backend).
 */
export function WebhooksTab({
  canWrite,
  canManageSecrets,
}: {
  canWrite: boolean;
  canManageSecrets: boolean;
}) {
  const { data, loading, error, notImplemented, reload } = useWebhooks();
  const { toast, toastError } = useToast();
  const [editing, setEditing] = useState<WebhookEndpoint | "new" | null>(null);
  const [deleting, setDeleting] = useState<WebhookEndpoint | null>(null);
  const [rotating, setRotating] = useState<WebhookEndpoint | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (notImplemented) {
    return <p className={styles.empty}>Integrações não estão disponíveis na demonstração.</p>;
  }
  if (loading && !data) return <SkeletonRows rows={3} label="Carregando webhooks" />;
  if (error) {
    return (
      <EmptyState
        tone="error"
        title="Não foi possível carregar os webhooks"
        message={error.message}
        actions={[{ label: "Tentar de novo", onClick: reload }]}
      />
    );
  }
  const endpoints = data?.endpoints ?? [];
  const events = data?.events ?? [];
  const selected = endpoints.find((e) => e.id === selectedId) ?? null;

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    try {
      await action();
      toast(ok);
      reload();
    } catch (err) {
      toastError(err, fail);
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.intro}>
          O CRM avisa seus sistemas (n8n, ERP…) quando algo acontece com um lead. Cada envio é
          assinado com HMAC-SHA256 no header <code>X-GSM-Signature</code>; falhas são retentadas
          automaticamente com espera crescente.
        </p>
        {canManageSecrets && (
          <Button variant="primary" onClick={() => setEditing("new")}>
            Novo webhook
          </Button>
        )}
      </div>

      <div className={styles.tableWrap}>
        {endpoints.length === 0 ? (
          <EmptyState
            compact
            title="Nenhum webhook configurado"
            message="Informe o endereço (https) do sistema que deve ser avisado — por exemplo, um fluxo do n8n — e escolha os eventos: lead criado, mudou de etapa, ganho ou perdido."
            actions={
              canManageSecrets ? [{ label: "Novo webhook", onClick: () => setEditing("new") }] : []
            }
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Eventos</th>
                <th>Status</th>
                <th>Última entrega</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {endpoints.map((w) => {
                const state = webhookState(w);
                return (
                  <tr
                    key={w.id}
                    className={`${styles.clickable} ${w.id === selectedId ? styles.selected : ""}`}
                    onClick={() => setSelectedId(w.id === selectedId ? null : w.id)}
                  >
                    <td>
                      <div className={styles.mono}>{w.url}</div>
                      {w.description && <div className={styles.muted}>{w.description}</div>}
                      <div className={styles.muted}>Secret terminado em …{w.secretHint}</div>
                    </td>
                    <td>
                      <div className={styles.chips}>
                        {w.events.map((e) => (
                          <span key={e} className={styles.chip}>
                            {e}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.pill} ${styles[state.tone]}`}>{state.label}</span>
                      {w.disabledReason && <div className={styles.muted}>{w.disabledReason}</div>}
                      {w.consecutiveFailures > 0 && (
                        <div className={styles.muted}>
                          {w.consecutiveFailures} falha(s) seguida(s)
                        </div>
                      )}
                    </td>
                    <td>
                      {w.lastDeliveryAt ? (
                        <>
                          <div>{formatDateTime(w.lastDeliveryAt)}</div>
                          <span
                            className={`${styles.pill} ${styles[deliveryTone(w.lastDeliveryStatus ?? "")]}`}
                          >
                            {deliveryStatusLabel(w.lastDeliveryStatus ?? "")}
                            {w.lastDeliveryStatusCode !== null && ` · ${w.lastDeliveryStatusCode}`}
                          </span>
                        </>
                      ) : (
                        <span className={styles.muted}>Nenhuma ainda</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {canWrite && (
                        <div className={styles.rowActions}>
                          <Button
                            onClick={() =>
                              void run(
                                () => integrationsService.sendTest(w.id),
                                "Evento de teste enfileirado.",
                                "Não foi possível enviar o teste.",
                              )
                            }
                            disabled={w.status !== "active"}
                            title={w.status !== "active" ? "Ative o webhook para testar" : undefined}
                          >
                            Testar
                          </Button>
                          <Button onClick={() => setEditing(w)}>Editar</Button>
                          <Button
                            onClick={() =>
                              void run(
                                () =>
                                  integrationsService.updateWebhook(w.id, {
                                    status: w.status === "active" ? "paused" : "active",
                                  }),
                                w.status === "active" ? "Webhook pausado." : "Webhook ativado.",
                                "Não foi possível alterar o status.",
                              )
                            }
                          >
                            {w.status === "active" ? "Pausar" : "Ativar"}
                          </Button>
                          {canManageSecrets && (
                            <>
                              <Button onClick={() => setRotating(w)}>Novo secret</Button>
                              <Button variant="danger" onClick={() => setDeleting(w)}>
                                Excluir
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && <DeliveriesPanel endpoint={selected} canWrite={canWrite} />}

      {editing && (
        <WebhookFormModal
          endpoint={editing === "new" ? null : editing}
          events={events}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            if (created) setRevealed(created.secret);
            reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Excluir webhook"
          message={`Os envios para ${deleting.url} param e o histórico de entregas deste endpoint é apagado.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await integrationsService.deleteWebhook(deleting.id);
              toast("Webhook excluído.");
              if (selectedId === deleting.id) setSelectedId(null);
              reload();
              return true;
            } catch (err) {
              toastError(err, "Não foi possível excluir o webhook.");
              return false;
            }
          }}
        />
      )}
      {rotating && (
        <ConfirmDialog
          title="Gerar novo secret"
          message="O secret atual deixa de assinar os próximos envios imediatamente. Atualize a validação no seu sistema logo em seguida."
          confirmLabel="Gerar novo secret"
          onClose={() => setRotating(null)}
          onConfirm={async () => {
            try {
              const result = await integrationsService.rotateWebhookSecret(rotating.id);
              setRevealed(result.secret);
              reload();
              return true;
            } catch (err) {
              toastError(err, "Não foi possível gerar um novo secret.");
              return false;
            }
          }}
        />
      )}
      {revealed && (
        <SecretReveal
          title="Secret do webhook"
          label="Secret de assinatura"
          secret={revealed}
          extra="Use para validar o header X-GSM-Signature (HMAC-SHA256 de `timestamp.corpo`)."
          onClose={() => setRevealed(null)}
        />
      )}
    </>
  );
}

function WebhookFormModal({
  endpoint,
  events,
  onClose,
  onSaved,
}: {
  endpoint: WebhookEndpoint | null;
  events: WebhookEventDefinition[];
  onClose: () => void;
  onSaved: (created: WebhookWithSecret | null) => void;
}) {
  const { toast, toastError } = useToast();
  const [url, setUrl] = useState(endpoint?.url ?? "");
  const [description, setDescription] = useState(endpoint?.description ?? "");
  const [selected, setSelected] = useState<string[]>(endpoint?.events ?? []);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    const invalid = validateWebhookDraft(url, selected);
    setProblem(invalid);
    if (invalid) return;
    setBusy(true);
    const input = { url: url.trim(), events: selected, description: description.trim() || null };
    try {
      if (endpoint) {
        await integrationsService.updateWebhook(endpoint.id, input);
        toast("Webhook atualizado.");
        onSaved(null);
      } else {
        onSaved(await integrationsService.createWebhook(input));
      }
    } catch (err) {
      toastError(err, "Não foi possível salvar o webhook.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={endpoint ? "Editar webhook" : "Novo webhook"}
      subtitle="Só HTTPS público. Endereços internos/privados são recusados."
      onClose={busy ? () => undefined : onClose}
    >
      <div className={form.form}>
        <label className={form.field}>
          <span className={form.label}>URL</span>
          <input
            className={form.input}
            value={url}
            maxLength={2000}
            placeholder="https://seu-n8n.exemplo.com/webhook/crm"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className={form.field}>
          <span className={form.label}>Descrição (opcional)</span>
          <input
            className={form.input}
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className={form.field}>
          <span className={form.label}>Eventos</span>
          <div className={styles.checkList}>
            {events.map((ev) => (
              <label key={ev.type} className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={selected.includes(ev.type)}
                  onChange={() => setSelected((cur) => toggleItem(cur, ev.type))}
                />
                <span>
                  <strong className={styles.mono}>{ev.type}</strong>
                  <div className={styles.muted}>{ev.description}</div>
                </span>
              </label>
            ))}
          </div>
        </div>
        {problem && <p className={form.error}>{problem}</p>}
        <div className={form.actions}>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "Salvando…" : endpoint ? "Salvar" : "Criar webhook"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const STATUS_FILTERS = Object.entries(DELIVERY_STATUS_LABEL) as [string, string][];

function DeliveriesPanel({ endpoint, canWrite }: { endpoint: WebhookEndpoint; canWrite: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, loading, error, reload } = useWebhookDeliveries(endpoint.id, status, page);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <h3 className={styles.panelTitle}>Entregas — {endpoint.url}</h3>
        <div className={styles.rowActions}>
          <select
            className={form.select}
            value={status ?? ""}
            onChange={(e) => {
              setStatus(e.target.value || null);
              setPage(1);
            }}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            {STATUS_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button onClick={reload}>Atualizar</Button>
        </div>
      </div>
      {error ? (
        <p className={styles.empty}>{error.message}</p>
      ) : loading && !data ? (
        <p className={styles.empty}>Carregando…</p>
      ) : !data || data.items.length === 0 ? (
        <p className={styles.empty}>Nenhuma entrega {status ? "com esse status" : "ainda"}.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Evento</th>
                <th>Status</th>
                <th>Tentativas</th>
                <th>Último resultado</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((d) => (
                <tr key={d.id} className={styles.clickable} onClick={() => setOpenId(d.id)}>
                  <td className={styles.mono}>{d.eventType}</td>
                  <td>
                    <span className={`${styles.pill} ${styles[deliveryTone(d.status)]}`}>
                      {deliveryStatusLabel(d.status)}
                    </span>
                    {d.status === "retrying" && (
                      <div className={styles.muted}>Próxima: {formatDateTime(d.nextAttemptAt)}</div>
                    )}
                  </td>
                  <td>
                    {d.attempts}/{d.maxAttempts}
                  </td>
                  <td>{lastResultLabel(d.lastStatusCode, d.lastError)}</td>
                  <td>{formatDateTime(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > data.pageSize && (
        <div className={styles.pager}>
          <Button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
            Anterior
          </Button>
          <span>
            Página {page} de {totalPages}
          </span>
          <Button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
            Próxima
          </Button>
        </div>
      )}
      {openId && (
        <DeliveryDetailModal
          id={openId}
          canWrite={canWrite}
          onClose={() => setOpenId(null)}
          onRedelivered={() => {
            setOpenId(null);
            reload();
          }}
        />
      )}
    </section>
  );
}

function DeliveryDetailModal({
  id,
  canWrite,
  onClose,
  onRedelivered,
}: {
  id: string;
  canWrite: boolean;
  onClose: () => void;
  onRedelivered: () => void;
}) {
  const { data, loading, error } = useWebhookDelivery(id);
  const { toast, toastError } = useToast();
  const [busy, setBusy] = useState(false);

  async function redeliver() {
    setBusy(true);
    try {
      await integrationsService.redeliver(id);
      toast("Reenvio enfileirado (mesmo event_id).");
      onRedelivered();
    } catch (err) {
      toastError(err, "Não foi possível reenviar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Detalhe da entrega" onClose={onClose}>
      {error ? (
        <p className={form.error}>{error.message}</p>
      ) : loading || !data ? (
        <p className={styles.empty}>Carregando…</p>
      ) : (
        <>
          <dl className={styles.dl}>
            <dt>Evento</dt>
            <dd className={styles.mono}>{data.eventType}</dd>
            <dt>event_id</dt>
            <dd className={styles.mono}>{data.eventId}</dd>
            <dt>Status</dt>
            <dd>
              <span className={`${styles.pill} ${styles[deliveryTone(data.status)]}`}>
                {deliveryStatusLabel(data.status)}
              </span>
            </dd>
            <dt>Tentativas</dt>
            <dd>
              {data.attempts}/{data.maxAttempts}
            </dd>
            {data.deliveredAt && (
              <>
                <dt>Entregue em</dt>
                <dd>{formatDateTime(data.deliveredAt)}</dd>
              </>
            )}
            {data.status === "retrying" && (
              <>
                <dt>Próxima tentativa</dt>
                <dd>{formatDateTime(data.nextAttemptAt)}</dd>
              </>
            )}
          </dl>
          <h4 className={styles.panelTitle}>Histórico de tentativas</h4>
          {data.history.length === 0 ? (
            <p className={styles.muted}>Ainda não houve tentativa.</p>
          ) : (
            <ol className={styles.history}>
              {data.history.map((a) => (
                <li key={a.attempt} className={styles.historyItem}>
                  <strong>#{a.attempt}</strong> · {formatDateTime(a.startedAt)} ·{" "}
                  {describeAttempt(a)}
                  {a.error && <div className={styles.muted}>{a.error}</div>}
                  {a.responseExcerpt && (
                    <pre className={styles.pre} style={{ marginTop: 6 }}>
                      {a.responseExcerpt}
                    </pre>
                  )}
                </li>
              ))}
            </ol>
          )}
          <h4 className={styles.panelTitle} style={{ marginTop: 12 }}>
            Payload
          </h4>
          <pre className={styles.pre}>{JSON.stringify(data.payload, null, 2)}</pre>
          <div className={form.actions}>
            <Button onClick={onClose}>Fechar</Button>
            {canWrite && (data.status === "failed" || data.status === "succeeded") && (
              <Button variant="primary" onClick={() => void redeliver()} disabled={busy}>
                {busy ? "Enfileirando…" : "Reenviar"}
              </Button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
