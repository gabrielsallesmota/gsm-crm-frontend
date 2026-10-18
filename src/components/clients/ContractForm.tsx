import { useId, useState } from "react";
import type {
  ClientContract,
  CreateContractInput,
  RenewalAlertMode,
  UpdateContractInput,
} from "../../types/client";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import type { RenewalDefault } from "../../hooks/useRenewalDefault";
import { toIsoDate } from "../../utils/renewal";
import { alertPreview, validateContractDraft } from "../../utils/contracts";
import styles from "./ClientDrawer.module.css";
import local from "./Contracts.module.css";

/** "default" = sem regra própria: vale o padrão da empresa (Automações → Renovação de contrato). */
type AlertChoice = "default" | RenewalAlertMode;

interface Draft {
  title: string;
  valueReais: number;
  startDate: string;
  endDate: string;
  renewalDate: string;
  alert: AlertChoice;
  alertValue: number;
  notes: string;
}

function fromContract(contract: ClientContract | null): Draft {
  return {
    title: contract?.title ?? "",
    valueReais: contract?.valueCents ? contract.valueCents / 100 : 0,
    startDate: contract?.startDate ?? toIsoDate(new Date()),
    endDate: contract?.endDate ?? "",
    renewalDate: contract?.renewalDate ?? "",
    alert: contract?.renewalAlertMode ?? "default",
    alertValue: contract?.renewalAlertValue ?? 1,
    notes: contract?.notes ?? "",
  };
}

export function ContractForm({
  contract,
  tenantDefault,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  /** `null` = novo contrato. */
  contract: ClientContract | null;
  tenantDefault: RenewalDefault | null;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (input: CreateContractInput & UpdateContractInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => fromContract(contract));
  const [saving, setSaving] = useState(false);
  const uid = useId();
  const problem = validateContractDraft(draft);
  // Com parcelas geradas, o valor do contrato é a soma delas: edite pelas parcelas.
  const valueLocked = contract !== null && contract.installmentCount !== null;
  const ownAlert = draft.alert !== "default";
  const usesValue = draft.alert === "days_before" || draft.alert === "months_before";
  const preview = alertPreview(
    draft.renewalDate,
    ownAlert ? (draft.alert as RenewalAlertMode) : null,
    usesValue ? draft.alertValue : 0,
    tenantDefault,
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function submit() {
    if (problem) return;
    setSaving(true);
    try {
      const wasEditing = contract !== null;
      const input: CreateContractInput & UpdateContractInput = {
        startDate: draft.startDate,
        title: draft.title.trim(),
        notes: draft.notes,
      };
      if (!valueLocked && draft.valueReais > 0) input.valueCents = Math.round(draft.valueReais * 100);
      if (draft.endDate) input.endDate = draft.endDate;
      else if (wasEditing && contract.endDate) input.clearEndDate = true;
      if (draft.renewalDate) input.renewalDate = draft.renewalDate;
      else if (wasEditing && contract.renewalDate) input.clearRenewalDate = true;
      if (ownAlert) {
        input.renewalAlertMode = draft.alert as RenewalAlertMode;
        input.renewalAlertValue = usesValue ? draft.alertValue : 0;
      } else if (wasEditing && contract.renewalAlertMode) {
        input.resetAlert = true;
      }
      await onSubmit(input);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={local.form}>
      <label className={styles.label} htmlFor={`${uid}-title`}>
        Nome do contrato (opcional)
      </label>
      <input
        id={`${uid}-title`}
        className={styles.editInput}
        placeholder="Ex.: Consórcio 2026, Plano anual"
        maxLength={200}
        value={draft.title}
        onChange={(e) => set("title", e.target.value)}
      />

      <label className={styles.label} htmlFor={`${uid}-value`}>
        Valor do contrato
      </label>
      <CurrencyInput
        id={`${uid}-value`}
        className={styles.editInput}
        value={draft.valueReais}
        disabled={valueLocked}
        onChange={(v) => set("valueReais", v)}
      />
      {valueLocked && (
        <p className={styles.mutedText}>O valor segue a soma das parcelas — altere pelas parcelas.</p>
      )}

      <div className={local.dates}>
        <div>
          <label className={styles.label} htmlFor={`${uid}-start`}>
            Início
          </label>
          <input
            id={`${uid}-start`}
            className={styles.editInput}
            type="date"
            value={draft.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor={`${uid}-end`}>
            Fim (opcional)
          </label>
          <input
            id={`${uid}-end`}
            className={styles.editInput}
            type="date"
            value={draft.endDate}
            onChange={(e) => set("endDate", e.target.value)}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor={`${uid}-renewal`}>
            Data de renovação
          </label>
          <input
            id={`${uid}-renewal`}
            className={styles.editInput}
            type="date"
            value={draft.renewalDate}
            onChange={(e) => set("renewalDate", e.target.value)}
          />
        </div>
      </div>

      <fieldset className={local.alertBox} disabled={!draft.renewalDate}>
        <legend className={styles.label}>Aviso de renovação</legend>
        <select
          className={styles.editInput}
          aria-label="Quando avisar sobre a renovação"
          value={draft.alert}
          onChange={(e) => set("alert", e.target.value as AlertChoice)}
        >
          <option value="default">Padrão da empresa</option>
          <option value="month_start">No 1º dia do mês da renovação</option>
          <option value="days_before">Dias antes da renovação</option>
          <option value="months_before">Meses antes da renovação</option>
        </select>
        {usesValue && (
          <label className={local.inline}>
            <input
              className={styles.editInput}
              type="number"
              min={0}
              max={draft.alert === "months_before" ? 24 : 365}
              aria-label={draft.alert === "months_before" ? "Meses de antecedência" : "Dias de antecedência"}
              value={draft.alertValue}
              onChange={(e) => set("alertValue", Math.max(0, Number(e.target.value) || 0))}
            />
            <span>{draft.alert === "months_before" ? "meses antes" : "dias antes"}</span>
          </label>
        )}
        {preview && <p className={local.preview}>{preview}</p>}
        {!draft.renewalDate && (
          <p className={styles.mutedText}>Informe a data de renovação para receber o aviso.</p>
        )}
      </fieldset>

      <label className={styles.label} htmlFor={`${uid}-notes`}>
        Observações
      </label>
      <textarea
        id={`${uid}-notes`}
        className={styles.editTextarea}
        maxLength={2000}
        value={draft.notes}
        onChange={(e) => set("notes", e.target.value)}
      />

      {problem && (
        <p className={local.error} role="alert">
          {problem}
        </p>
      )}
      <div className={styles.formActions}>
        <Button onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => void submit()} disabled={saving || Boolean(problem)}>
          {saving ? "Salvando…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
