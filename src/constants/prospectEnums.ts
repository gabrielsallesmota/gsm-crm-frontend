import type {
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
  nao_verificado: { label: "Não verificado", color: "#9aa6b2", bg: "rgba(255,255,255,.06)" },
  valido: { label: "Válido", color: "#2ee66e", bg: "rgba(46,230,110,.12)" },
  invalido: { label: "Inválido", color: "#ff6b6b", bg: "rgba(255,107,107,.12)" },
  contatado_sem_resposta: { label: "Contatado, sem resposta", color: "#f5b13d", bg: "rgba(245,177,61,.14)" },
  respondeu: { label: "Respondeu", color: "#4aa3ff", bg: "rgba(74,163,255,.14)" },
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
  a: { label: "A", color: "#ff6b6b", bg: "rgba(255,107,107,.14)" },
  b: { label: "B", color: "#f5b13d", bg: "rgba(245,177,61,.14)" },
  c: { label: "C", color: "#9aa6b2", bg: "rgba(255,255,255,.06)" },
};

export const PROSPECT_ORIGIN: Record<ProspectOrigin, { label: string; color: string; bg: string }> = {
  google_maps: { label: "Google Maps", color: "#f5b13d", bg: "rgba(245,177,61,.14)" },
  indicacao: { label: "Indicação", color: "#2ee66e", bg: "rgba(46,230,110,.12)" },
  instagram: { label: "Instagram", color: "#e1719c", bg: "rgba(225,48,108,.14)" },
  site: { label: "Site", color: "#4aa3ff", bg: "rgba(74,163,255,.14)" },
  evento: { label: "Evento", color: "#a78bfa", bg: "rgba(167,139,250,.16)" },
  outro: { label: "Outro", color: "#9aa6b2", bg: "rgba(255,255,255,.06)" },
};
