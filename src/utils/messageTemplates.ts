import type { MessageTemplate, Prospect, ProspectMessageField, ProspectStage } from "../types/prospect";

// U+0300–U+036F = bloco Unicode "Combining Diacritical Marks" — é nele que
// `String.prototype.normalize("NFKD")` decompõe acentos (ex.: "á" vira "a" +
// U+0301). Removendo esse intervalo depois do NFKD sobra só o texto sem
// acento, minúsculo.
const COMBINING_DIACRITICS_RE = /[̀-ͯ]/g;

/** Mesmo algoritmo do backend (`normalize_niche` em
 * `domain/services.py`) — precisa produzir o mesmo resultado dos dois
 * lados, já que aqui só é usado pra achar o template certo (o backend é
 * quem garante que não existem dois templates duplicados pro mesmo par
 * estágio/área). Remove acentos + baixa caixa; "" e espaços em branco
 * viram `null` (coringa). */
export function normalizeNiche(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().toLowerCase().normalize("NFKD").replace(COMBINING_DIACRITICS_RE, "");
}

/**
 * Acha o template certo pro prospect atual: primeiro tenta um template
 * específico da área dele nesse estágio; se não achar, cai pro coringa
 * (`niche: null`) desse mesmo estágio. `undefined` quando nenhum dos dois existe.
 */
export function findMatchingTemplate(
  prospect: Prospect,
  templates: MessageTemplate[],
): MessageTemplate | undefined {
  const stageTemplates = templates.filter((t) => t.stageId === prospect.stageId);
  if (stageTemplates.length === 0) return undefined;

  const prospectNiche = normalizeNiche(prospect.niche);
  const specific = stageTemplates.find((t) => normalizeNiche(t.niche) === prospectNiche);
  if (specific) return specific;

  return stageTemplates.find((t) => t.niche === null);
}

const PLACEHOLDERS: { token: string; get: (p: Prospect) => string }[] = [
  { token: "{empresa}", get: (p) => p.companyName },
  { token: "{nicho}", get: (p) => p.niche },
  { token: "{servico_principal}", get: (p) => p.mainService },
  { token: "{cidade}", get: (p) => p.city },
  { token: "{bairro}", get: (p) => p.neighborhood },
  // Mesmo formato usado no resto da tela pra exibir a nota (ver
  // `ProspectDrawer.tsx`, `display={... String(prospect.googleRating) ...}`)
  // — sem casas decimais fixas nem vírgula, só `String(number)`.
  { token: "{avaliacao_google}", get: (p) => (p.googleRating != null ? String(p.googleRating) : "") },
];

/** Substitui os placeholders (`{empresa}`, `{nicho}`, ...) num texto
 * qualquer — usado tanto por `renderMessage` (template padrão) quanto por
 * `resolveProspectMessage` (mensagem própria do prospect, ver lá). */
export function renderMessageText(text: string, prospect: Prospect): string {
  return PLACEHOLDERS.reduce((acc, { token, get }) => acc.split(token).join(get(prospect) || ""), text);
}

export function renderMessage(template: MessageTemplate, prospect: Prospect): string {
  return renderMessageText(template.message, prospect);
}

const MESSAGE_FIELD_TO_PROSPECT_KEY: Record<ProspectMessageField, keyof Prospect> = {
  message_1: "message1",
  message_2: "message2",
  message_3: "message3",
  message_4: "message4",
};

/**
 * Mensagem de WhatsApp pro prospect no estágio ATUAL, na ordem certa de
 * prioridade: (1) se o estágio tem `messageField` configurado e o prospect
 * tem texto nesse campo, usa ele — é o pedido do usuário de referenciar uma
 * coluna específica do CSV por estágio, em vez do template compartilhado;
 * (2) senão, cai no template padrão por (estágio, área) de sempre (ver
 * `findMatchingTemplate`). `undefined` quando nenhum dos dois resolve — é
 * esse retorno que decide se `WhatsappButton` aparece ou não.
 */
export function resolveProspectMessage(
  prospect: Prospect,
  stage: ProspectStage | undefined,
  templates: MessageTemplate[],
): string | undefined {
  if (stage?.messageField) {
    const raw = prospect[MESSAGE_FIELD_TO_PROSPECT_KEY[stage.messageField]];
    if (typeof raw === "string" && raw.trim()) return renderMessageText(raw, prospect);
  }
  const template = findMatchingTemplate(prospect, templates);
  return template ? renderMessage(template, prospect) : undefined;
}

/** `wa.me` espera só dígitos com DDI — é exatamente o que `phoneNormalized`
 * já é (ver `normalize_phone` no backend). */
export function buildWhatsappUrl(phoneNormalized: string, message: string): string {
  return `https://wa.me/${phoneNormalized}?text=${encodeURIComponent(message)}`;
}
