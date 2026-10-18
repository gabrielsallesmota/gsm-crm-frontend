import { useId, type ReactNode } from "react";
import type { Tag } from "../../../types/tag";
import { ORIGIN, ORIGIN_KEYS } from "../../../constants/origins";
import {
  LEAD_FIELD_LIMITS,
  type LeadFormErrors,
  type LeadFormField,
  type LeadFormValues,
} from "../../../utils/leadForm";
import { readableTextColor } from "../../../utils/colors";
import { formatPhone } from "../../../utils/phone";
import { CurrencyInput } from "../../common/CurrencyInput";
import styles from "../LeadDrawer.module.css";

function Field({
  id,
  label,
  required,
  error,
  hint,
  wide,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string | undefined;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? `${styles.formField} ${styles.formFieldWide}` : styles.formField}>
      <div>
        <label className={styles.formLabel} htmlFor={id}>
          {label}
        </label>
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p className={styles.fieldError} id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className={styles.fieldHint} id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/**
 * Formulário de edição agrupado (identificação · contato · oportunidade · complementar).
 * Mostra o erro ao lado do campo depois que a pessoa sai dele ou tenta salvar; as regras de
 * negócio continuam no backend. Etapa e responsável NÃO estão aqui: gravam na hora no resumo.
 */
export function LeadEditForm({
  values,
  errors,
  touched,
  availableTags,
  onChange,
  onTouch,
}: {
  values: LeadFormValues;
  errors: LeadFormErrors;
  touched: ReadonlySet<LeadFormField>;
  availableTags: Tag[] | null | undefined;
  onChange: (patch: Partial<LeadFormValues>) => void;
  onTouch: (field: LeadFormField) => void;
}) {
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;
  const err = (field: LeadFormField) => (touched.has(field) ? errors[field] : undefined);
  const attrs = (field: LeadFormField, required = false) => ({
    id: id(field),
    "aria-invalid": err(field) ? true : undefined,
    "aria-required": required || undefined,
    "aria-describedby": err(field) ? `${id(field)}-error` : undefined,
    onBlur: () => onTouch(field),
  });
  const cls = (field: LeadFormField, base: string | undefined) =>
    [base, err(field) ? styles.inputInvalid : undefined].filter(Boolean).join(" ");

  function toggleTag(tagId: string) {
    onChange({
      tags: values.tags.includes(tagId)
        ? values.tags.filter((t) => t !== tagId)
        : [...values.tags, tagId],
    });
  }

  return (
    <div className={styles.form} aria-label="Editar lead" role="group">
      <fieldset className={styles.formGroup}>
        <legend className={styles.formGroupTitle}>Identificação</legend>
        <Field id={id("name")} label="Nome" required error={err("name")} wide>
          <input
            {...attrs("name", true)}
            className={cls("name", styles.input)}
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field id={id("company")} label="Empresa" error={err("company")} wide>
          <input
            {...attrs("company")}
            className={cls("company", styles.input)}
            value={values.company}
            onChange={(e) => onChange({ company: e.target.value })}
          />
        </Field>
      </fieldset>

      <fieldset className={styles.formGroup}>
        <legend className={styles.formGroupTitle}>Contato</legend>
        <Field id={id("phone")} label="Telefone" error={err("phone")}>
          <input
            {...attrs("phone")}
            className={cls("phone", styles.input)}
            inputMode="tel"
            value={values.phone}
            onChange={(e) => onChange({ phone: formatPhone(e.target.value) })}
          />
        </Field>
        <Field id={id("email")} label="E-mail" error={err("email")}>
          <input
            {...attrs("email")}
            className={cls("email", styles.input)}
            inputMode="email"
            value={values.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </Field>
      </fieldset>

      <fieldset className={styles.formGroup}>
        <legend className={styles.formGroupTitle}>Oportunidade</legend>
        <Field id={id("value")} label="Valor">
          <CurrencyInput
            id={id("value")}
            className={styles.input}
            value={values.value}
            onChange={(v) => onChange({ value: v })}
          />
        </Field>
        <Field
          id={id("probability")}
          label="Probabilidade"
          error={err("probability")}
          hint="De 0 a 100 (%)."
        >
          <input
            {...attrs("probability")}
            className={cls("probability", styles.input)}
            type="number"
            min={0}
            max={100}
            value={values.probability}
            onChange={(e) => onChange({ probability: e.target.value })}
          />
        </Field>
        <Field id={id("origin")} label="Origem" wide>
          <select
            id={id("origin")}
            className={styles.input}
            value={values.origin}
            onChange={(e) => onChange({ origin: e.target.value })}
          >
            {!ORIGIN_KEYS.some((k) => k === values.origin) && (
              <option value={values.origin}>{values.origin || "—"}</option>
            )}
            {ORIGIN_KEYS.map((k) => (
              <option key={k} value={k}>
                {ORIGIN[k].label}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className={styles.formGroup}>
        <legend className={styles.formGroupTitle}>Complementar</legend>
        {availableTags && availableTags.length > 0 && (
          <div className={`${styles.formField} ${styles.formFieldWide}`}>
            <span className={styles.formLabel} id={id("tags")}>
              Tags
            </span>
            <div className={styles.tagOptions} role="group" aria-labelledby={id("tags")}>
              {availableTags.map((tag) => {
                const active = values.tags.includes(tag.id);
                return (
                  <button
                    type="button"
                    key={tag.id}
                    className={
                      active ? `${styles.tagOption} ${styles.tagOptionActive}` : styles.tagOption
                    }
                    style={
                      active ? { color: readableTextColor(tag.color), background: tag.bg } : undefined
                    }
                    onClick={() => toggleTag(tag.id)}
                    aria-pressed={active}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <Field id={id("notes")} label="Notas" error={err("notes")} wide>
          <textarea
            {...attrs("notes")}
            className={cls("notes", styles.textarea)}
            value={values.notes}
            rows={4}
            placeholder="Anotações sobre o lead…"
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </Field>
      </fieldset>
    </div>
  );
}

export { LEAD_FIELD_LIMITS };
