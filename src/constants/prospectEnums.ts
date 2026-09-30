import type {
  ContactChannel,
  PageObjective,
  PhoneType,
  ProspectOrigin,
  ProspectPriority,
  SiteStatus,
  WhatsappStatus,
} from "../types/prospect";

export const PHONE_TYPE: Record<PhoneType, { label: string }> = {
  comercial: { label: "Comercial" },
  pessoal: { label: "Pessoal" },
  nao_verificado: { label: "Não verificado" },
};

export const WHATSAPP_STATUS: Record<WhatsappStatus, { label: string; color: string; bg: string }> = {
  nao_verificado: { label: "Não verificado", color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
  valido: { label: "Válido", color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  invalido: { label: "Inválido", color: "var(--tone-red)", bg: "var(--tone-red-bg)" },
  contatado_sem_resposta: { label: "Contatado, sem resposta", color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  respondeu: { label: "Respondeu", color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
};

export const SITE_STATUS: Record<SiteStatus, { label: string }> = {
  sem_site: { label: "Sem site" },
  apenas_rede_social: { label: "Apenas rede social" },
  site_proprio: { label: "Site próprio" },
  site_fraco: { label: "Site fraco" },
  nao_verificado: { label: "Não verificado" },
};

export const PAGE_OBJECTIVE: Record<PageObjective, { label: string }> = {
  orcamento: { label: "Orçamento" },
  agendamento: { label: "Agendamento" },
  apresentacao: { label: "Apresentação" },
  matricula: { label: "Matrícula" },
  reserva: { label: "Reserva" },
};

export const PRIORITY: Record<ProspectPriority, { label: string; color: string; bg: string }> = {
  a: { label: "A", color: "var(--tone-red)", bg: "var(--tone-red-bg)" },
  b: { label: "B", color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  c: { label: "C", color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
};

/** Canal de abordagem recomendado — cores reaproveitadas das já existentes
 * no projeto (whatsapp = mesmo verde de `WHATSAPP_STATUS.valido`, instagram
 * = mesmo rosa de `PROSPECT_ORIGIN.instagram`/`origins.ts`). "E-mail" é tag
 * branca de propósito (pedido do usuário): texto escuro sobre quase-branco,
 * legível mesmo no tema escuro do resto do app. */
export const CONTACT_CHANNEL: Record<ContactChannel, { label: string; color: string; bg: string }> = {
  whatsapp: { label: "WhatsApp", color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  instagram: { label: "Instagram", color: "var(--tone-pink)", bg: "var(--tone-pink-bg)" },
  email: { label: "E-mail", color: "var(--tone-email)", bg: "var(--tone-email-bg)" },
};

export const PROSPECT_ORIGIN: Record<ProspectOrigin, { label: string; color: string; bg: string }> = {
  google_maps: { label: "Google Maps", color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  indicacao: { label: "Indicação", color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  instagram: { label: "Instagram", color: "var(--tone-pink)", bg: "var(--tone-pink-bg)" },
  site: { label: "Site", color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
  evento: { label: "Evento", color: "var(--tone-purple)", bg: "var(--tone-purple-bg)" },
  outro: { label: "Outro", color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
  sdr: { label: "SDR", color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
};

/** Origens que dá pra escolher à mão (cadastro, importação, edição). "SDR"
 * só o backend define, ao aprovar um candidato. */
export const SELECTABLE_PROSPECT_ORIGINS = (
  Object.keys(PROSPECT_ORIGIN) as (keyof typeof PROSPECT_ORIGIN)[]
).filter((origin) => origin !== "sdr");

/**
 * Lê o rótulo/cores de um valor de enum sem derrubar a tela: valor fora do
 * mapa (dado antigo, API numa versão diferente do front) cai no `fallback`
 * e é avisado no console com o campo e o valor, pra dar pra corrigir a
 * origem. Antes, `MAPA[valor].label` com valor desconhecido quebrava o
 * drawer inteiro ("Cannot read properties of undefined (reading 'label')").
 */
export function enumMeta<K extends string, V>(
  map: Record<K, V>,
  value: string | null | undefined,
  fallback: K,
  field: string,
): V {
  const meta = value != null ? (map as Record<string, V | undefined>)[value] : undefined;
  if (meta) return meta;
  console.warn(`Valor inesperado em ${field}:`, value);
  return map[fallback];
}

