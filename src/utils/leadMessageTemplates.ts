import type { Lead, LeadMessageTemplate } from "../types/lead";
import { buildWhatsappUrl } from "./messageTemplates";

export { buildWhatsappUrl };

/**
 * Acha o template certo pro lead atual: primeiro tenta um template
 * específico da origem dele nesse estágio; se não achar, cai pro coringa
 * (`origin: null`) desse mesmo estágio. `undefined` quando nenhum dos dois
 * existe. Sem normalização de texto (diferente do nicho do Prospect) porque
 * `origin` é um enum fixo do backend, não texto livre — comparação direta
 * já é estável nos dois lados.
 */
export function findMatchingLeadTemplate(
  lead: Lead,
  templates: LeadMessageTemplate[],
): LeadMessageTemplate | undefined {
  const stageTemplates = templates.filter((t) => t.stageId === lead.stageId);
  if (stageTemplates.length === 0) return undefined;

  const specific = stageTemplates.find((t) => t.origin === lead.origin);
  if (specific) return specific;

  return stageTemplates.find((t) => t.origin === null);
}

const PLACEHOLDERS: { token: string; get: (l: Lead) => string }[] = [
  { token: "{nome}", get: (l) => l.name },
  { token: "{empresa}", get: (l) => l.company },
  { token: "{cidade}", get: (l) => l.city },
  { token: "{estado}", get: (l) => l.state },
];

export function renderLeadMessage(template: LeadMessageTemplate, lead: Lead): string {
  return PLACEHOLDERS.reduce(
    (text, { token, get }) => text.split(token).join(get(lead) || ""),
    template.message,
  );
}
