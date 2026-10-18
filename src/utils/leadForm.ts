// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { Lead } from "../types/lead.ts";

/** Valores do formulário de edição do lead (texto/número como a pessoa digita). */
export interface LeadFormValues {
  name: string;
  company: string;
  phone: string;
  email: string;
  value: number;
  probability: string;
  origin: string;
  notes: string;
  tags: string[];
}

export type LeadFormField = keyof LeadFormValues;
export type LeadFormErrors = Partial<Record<LeadFormField, string>>;

/** Mesmos tetos da API (`UpdateLeadRequest`): a tela avisa antes de o servidor recusar. */
export const LEAD_FIELD_LIMITS = {
  name: 200,
  company: 200,
  phone: 30,
  email: 255,
  notes: 4000,
} as const;

export function formFromLead(lead: Lead): LeadFormValues {
  return {
    name: lead.name,
    company: lead.company,
    phone: lead.phone,
    email: lead.email,
    value: lead.value,
    probability: String(lead.probability),
    origin: lead.origin,
    notes: lead.notes,
    tags: lead.tags,
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validação ao lado do campo. O backend continua sendo a autoridade (esta só antecipa o óbvio). */
export function validateLeadForm(values: LeadFormValues): LeadFormErrors {
  const errors: LeadFormErrors = {};
  if (!values.name.trim()) errors.name = "Informe o nome do lead.";
  for (const field of ["name", "company", "phone", "email", "notes"] as const) {
    const limit = LEAD_FIELD_LIMITS[field];
    if (values[field].length > limit && !errors[field]) {
      errors[field] = `Use no máximo ${limit} caracteres (agora ${values[field].length}).`;
    }
  }
  const email = values.email.trim();
  if (email && !errors.email && !EMAIL.test(email)) errors.email = "Informe um e-mail válido, como nome@empresa.com.";
  const probability = values.probability.trim();
  if (probability && !errors.probability) {
    const n = Number(probability);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.probability = "Use um valor entre 0 e 100 (será ajustado ao salvar).";
    }
  }
  return errors;
}

/** Há diferença entre o rascunho e o lead salvo? (espaços nas pontas não contam.) */
export function isFormDirty(values: LeadFormValues, lead: Lead): boolean {
  const base = formFromLead(lead);
  const same =
    values.name.trim() === base.name.trim() &&
    values.company.trim() === base.company.trim() &&
    values.phone.trim() === base.phone.trim() &&
    values.email.trim() === base.email.trim() &&
    values.value === base.value &&
    Number(values.probability) === Number(base.probability) &&
    values.origin === base.origin &&
    values.notes === base.notes &&
    values.tags.length === base.tags.length &&
    values.tags.every((t) => base.tags.includes(t));
  return !same;
}

/** Link `tel:` só quando há dígitos suficientes para uma ligação. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? `tel:+${digits.length <= 11 ? `55${digits}` : digits}` : null;
}
