import type { MessageTemplate, Prospect } from "../types/prospect";

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

export function renderMessage(template: MessageTemplate, prospect: Prospect): string {
  return PLACEHOLDERS.reduce(
    (text, { token, get }) => text.split(token).join(get(prospect) || ""),
    template.message,
  );
}

/** `wa.me` espera só dígitos com DDI — é exatamente o que `phoneNormalized`
 * já é (ver `normalize_phone` no backend). */
export function buildWhatsappUrl(phoneNormalized: string, message: string): string {
  return `https://wa.me/${phoneNormalized}?text=${encodeURIComponent(message)}`;
}
