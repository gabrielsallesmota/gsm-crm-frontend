import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Lead } from "../../types/lead";
import type { Client, PaymentType, RenewalAlertMode } from "../../types/client";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { useClientActions } from "../../hooks/useClientActions";
import { useClientAccess } from "../../hooks/useClientAccess";
import { useRenewalDefault } from "../../hooks/useRenewalDefault";
import { useToast } from "../../hooks/useToast";
import { clientsService } from "../../services/ClientsService";
import { ROUTES } from "../../constants/routes";
import { alertPreview } from "../../utils/contracts";
import { toIsoDate } from "../../utils/renewal";
import form from "../common/Form.module.css";

type Alert = "default" | RenewalAlertMode;

/**
 * "Criar cliente?" — aparece quando um lead vira GANHO (e no botão da ficha do lead). Pergunta, não
 * impõe: "Agora não" deixa tudo como está. O formulário já vem preenchido (valor do lead, data de
 * hoje) e pede a data de renovação e a forma de pagamento; as parcelas se montam depois na ficha do
 * cliente. Idempotente: se o lead já é cliente, oferece "Ver cliente".
 *
 * Vendedor cria o cliente do PRÓPRIO lead, mas sem os dados de contrato (valor é de admin e
 * gestor) — o formulário some e a ficha se completa depois por quem gerencia.
 */
export function CreateClientFromLeadDialog({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { toastError } = useToast();
  const { canManage } = useClientAccess();
  const { createFromLead } = useClientActions();
  const tenantDefault = useRenewalDefault();

  const [existing, setExisting] = useState<Client | null | undefined>(undefined);
  const [created, setCreated] = useState<Client | null>(null);
  const [valueReais, setValueReais] = useState(lead.value || 0);
  const [closedAt, setClosedAt] = useState(toIsoDate(new Date()));
  const [paymentType, setPaymentType] = useState<PaymentType>("vista");
  const [renewalDate, setRenewalDate] = useState("");
  const [alert, setAlert] = useState<Alert>("default");
  const [alertValue, setAlertValue] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    clientsService
      .findByLead(lead.id)
      .then((found) => !cancelled && setExisting(found))
      .catch(() => !cancelled && setExisting(null));
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  const usesValue = alert === "days_before" || alert === "months_before";
  const preview = alertPreview(
    renewalDate,
    alert === "default" ? null : alert,
    usesValue ? alertValue : 0,
    tenantDefault,
  );
  const dateProblem =
    renewalDate && renewalDate < closedAt ? "A renovação não pode ser antes do fechamento." : null;

  function openClient(id: string) {
    onClose();
    void navigate(ROUTES.clienteDetail(id));
  }

  async function submit() {
    if (dateProblem) return;
    setBusy(true);
    try {
      const result = await createFromLead({
        leadId: lead.id,
        closedAt,
        ...(canManage
          ? {
              contract: {
                startDate: closedAt,
                paymentType,
                ...(valueReais > 0 ? { valueCents: Math.round(valueReais * 100) } : {}),
                ...(renewalDate ? { renewalDate } : {}),
                ...(renewalDate && alert !== "default"
                  ? { renewalAlertMode: alert, renewalAlertValue: usesValue ? alertValue : 0 }
                  : {}),
              },
            }
          : {}),
      });
      setCreated(result.client);
    } catch (err) {
      toastError(err, "Não foi possível criar o cliente");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Modal title="Cliente criado" onClose={onClose}>
        <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.5 }}>
          “{created.companyName}” agora está em Clientes.
          {canManage
            ? " Abra a ficha para montar as parcelas e acompanhar a renovação."
            : " Quem gerencia os clientes completa o contrato e as parcelas na ficha."}
        </p>
        <div className={form.actions}>
          <Button onClick={onClose}>Fechar</Button>
          <Button variant="primary" onClick={() => openClient(created.id)}>
            Abrir ficha do cliente
          </Button>
        </div>
      </Modal>
    );
  }

  if (existing) {
    return (
      <Modal title="Este lead já é cliente" onClose={onClose}>
        <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.5 }}>
          “{existing.companyName}” já está cadastrado em Clientes.
        </p>
        <div className={form.actions}>
          <Button onClick={onClose}>Fechar</Button>
          <Button variant="primary" onClick={() => openClient(existing.id)}>
            Ver cliente
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Criar cliente?"
      subtitle={`“${lead.company || lead.name}” foi ganho. Cadastre como cliente para acompanhar contrato, parcelas e renovação.`}
      onClose={onClose}
    >
      {existing === undefined ? (
        <p style={{ margin: "12px 0 0", fontSize: 13 }}>Verificando…</p>
      ) : (
        <div className={form.form}>
          {canManage ? (
            <>
              <div className={form.field}>
                <label className={form.label} htmlFor="cfl-value">
                  Valor do contrato
                </label>
                <CurrencyInput
                  id="cfl-value"
                  className={form.input}
                  value={valueReais}
                  onChange={setValueReais}
                />
              </div>
              <div className={form.row}>
                <div className={form.field}>
                  <label className={form.label} htmlFor="cfl-closed">
                    Data de fechamento
                  </label>
                  <input
                    id="cfl-closed"
                    className={form.input}
                    type="date"
                    value={closedAt}
                    onChange={(e) => setClosedAt(e.target.value)}
                  />
                </div>
                <div className={form.field}>
                  <label className={form.label} htmlFor="cfl-payment">
                    Forma de pagamento
                  </label>
                  <select
                    id="cfl-payment"
                    className={form.select}
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                  >
                    <option value="vista">À vista</option>
                    <option value="mensal">Parcelado (mensal)</option>
                  </select>
                </div>
              </div>
              <div className={form.field}>
                <label className={form.label} htmlFor="cfl-renewal">
                  Data de renovação (opcional)
                </label>
                <input
                  id="cfl-renewal"
                  className={form.input}
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                />
                <p className={form.hint}>
                  Se o cliente volta periodicamente (consórcio, plano anual…), informe quando. Você
                  recebe uma tarefa de renovação antes dessa data.
                </p>
              </div>
              {renewalDate && (
                <div className={form.field}>
                  <label className={form.label} htmlFor="cfl-alert">
                    Aviso de renovação
                  </label>
                  <select
                    id="cfl-alert"
                    className={form.select}
                    value={alert}
                    onChange={(e) => setAlert(e.target.value as Alert)}
                  >
                    <option value="default">Padrão da empresa</option>
                    <option value="month_start">No 1º dia do mês da renovação</option>
                    <option value="days_before">Dias antes da renovação</option>
                    <option value="months_before">Meses antes da renovação</option>
                  </select>
                  {usesValue && (
                    <input
                      className={form.input}
                      type="number"
                      min={0}
                      max={alert === "months_before" ? 24 : 365}
                      aria-label={alert === "months_before" ? "Meses de antecedência" : "Dias de antecedência"}
                      value={alertValue}
                      onChange={(e) => setAlertValue(Math.max(0, Number(e.target.value) || 0))}
                    />
                  )}
                  {preview && <p className={form.hint}>{preview}</p>}
                </div>
              )}
              {dateProblem && (
                <p className={form.error} role="alert">
                  {dateProblem}
                </p>
              )}
            </>
          ) : (
            <p className={form.hint}>
              O cliente é criado com os dados do lead. O valor do contrato, as parcelas e a renovação
              são completados depois por quem gerencia os clientes.
            </p>
          )}
          <div className={form.actions}>
            <Button onClick={onClose} disabled={busy}>
              Agora não
            </Button>
            <Button
              variant="primary"
              onClick={() => void submit()}
              disabled={busy || Boolean(dateProblem)}
            >
              {busy ? "Criando…" : "Criar cliente"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
