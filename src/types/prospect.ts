export type PhoneType = "comercial" | "pessoal" | "nao_verificado";

export type WhatsappStatus =
  | "nao_verificado"
  | "valido"
  | "invalido"
  | "contatado_sem_resposta"
  | "respondeu";

export type SiteStatus =
  | "sem_site"
  | "apenas_rede_social"
  | "site_proprio"
  | "site_fraco"
  | "nao_verificado";

export type PageObjective = "orcamento" | "agendamento" | "apresentacao" | "matricula" | "reserva";

export type ProspectPriority = "a" | "b" | "c";

/** Canal de abordagem recomendado — decide a tag/ação do card
 * (`ChannelTag.tsx`): WhatsApp mantém o link `wa.me` de sempre; Instagram/
 * E-mail copiam a mensagem/e-mail pro clipboard em vez de abrir um link. */
export type ContactChannel = "whatsapp" | "instagram" | "email";

/** De onde a GSM achou o prospect — diferente da "origem" de um Lead (canal
 * pelo qual um CLIENTE do CRM recebeu um lead de fora). */
export type ProspectOrigin = "google_maps" | "indicacao" | "instagram" | "site" | "evento" | "outro";

export type DedupeStrategy = "skip" | "update" | "duplicate";

/** Qual dos 4 campos de mensagem livre do PRÓPRIO prospect
 * (`Prospect.message1`..`message4`) um estágio usa no botão de WhatsApp em
 * vez do template padrão — ver `ProspectStage.messageField`. */
export type ProspectMessageField = "message_1" | "message_2" | "message_3" | "message_4";

export interface ProspectStage {
  id: string;
  name: string;
  color: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
  // Mover um prospect pra este estágio deve pedir uma data alvo de
  // follow-up? Ver `Prospect.targetDate` e `ProspectionBoard.tsx`. Ignorado
  // quando `followupBusinessDays` está configurado (esse tem prioridade).
  asksTargetDate: boolean;
  // Cadência automática: dias ÚTEIS (seg-sex, sem feriados nacionais BR)
  // depois do estágio ANTERIOR (por `order`) até a data alvo deste
  // estágio. `null` = sem cadência automática aqui (mantém `asksTargetDate`).
  // Irrelevante no primeiro estágio da pipeline — esse É a âncora
  // (`Prospect.initialContactDate`). Configurado em "Estágios" → editar.
  followupBusinessDays: number | null;
  // Qual `Prospect.messageN` este estágio usa no botão de WhatsApp em vez
  // do template padrão — `null` = comportamento antigo (template por
  // estágio/área, ver `utils/messageTemplates.ts::resolveProspectMessage`).
  messageField: ProspectMessageField | null;
}

/** Anotação datada de alguém sobre o prospect — histórico append-only,
 * diferente de `positiveNote`/`opportunity` (campos livres únicos). */
export interface ProspectComment {
  id: string;
  prospectId: string;
  authorUserId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

/** Só o preview do comentário mais recente — mesma ideia de
 * `types/lead.ts::LastCommentPreview`. */
export interface LastProspectCommentPreview {
  text: string;
  createdAt: string;
}

export interface Prospect {
  id: string;
  sequenceNumber: number;
  stageId: string;
  companyName: string;
  niche: string;
  mainService: string;
  city: string;
  neighborhood: string;
  googleMapsUrl: string;
  phoneRaw: string;
  phoneNormalized: string;
  phoneType: PhoneType;
  whatsappStatus: WhatsappStatus;
  websiteUrl: string;
  siteStatus: SiteStatus;
  instagram: string;
  // Canal de abordagem recomendado — ver `ContactChannel`. `email`/
  // `emailSubject` ficam sempre disponíveis (dá pra ter um e-mail
  // cadastrado mesmo quando o canal principal é outro).
  contactChannel: ContactChannel;
  email: string;
  emailSubject: string;
  googleRating: number | null;
  googleReviewsCount: number | null;
  positiveNote: string;
  opportunity: string;
  pageObjective: PageObjective | null;
  priority: ProspectPriority;
  origin: ProspectOrigin;
  // Solução(ões) GSM ofertada(s) — texto livre, pode combinar mais de uma
  // com "+" (ex.: "Landing Page + Automação de WhatsApp"). Regra pra quem
  // preenche: só o que faz sentido pra `opportunity` deste lead, não é
  // pra "empurrar" oferta.
  offeredService: string;
  // Lead sem WhatsApp (contato só por e-mail/telefone) — desliga o link
  // "abrir WhatsApp" (`WhatsappButton.tsx`), mantém "Copiar". Independente
  // de `whatsappStatus` (funil de validação de outreach).
  noWhatsapp: boolean;
  // Motivo da perda — só relevante quando o estágio atual é `isLost`;
  // `null` = sem motivo registrado (raro depois de mover pra um estágio
  // perdido, já que o board pede na hora — ver `ProspectionBoard.tsx`).
  lossReasonId: string | null;
  // Mensagens específicas DESTE prospect — ver `ProspectStage.messageField`
  // e `IMPORTABLE_PROSPECT_FIELDS` (vêm do CSV de import ou digitadas à
  // mão). `""` = sem texto nesse campo (mesma convenção do resto dos
  // campos de texto opcionais aqui).
  message1: string;
  message2: string;
  message3: string;
  message4: string;
  // Data do primeiro contato (P0, "YYYY-MM-DD") — âncora da cadência
  // automática, definida na criação/import. Ver `Prospect.targetDate` e
  // `ProspectStage.followupBusinessDays`.
  initialContactDate: string | null;
  // Próxima data de follow-up ("YYYY-MM-DD") do estágio ATUAL. Quando a
  // cadência automática cobre o caminho até o estágio atual, já vem
  // calculada sozinha a partir de `initialContactDate` — só é perguntada
  // manualmente ao mover (`ProspectStage.asksTargetDate`) quando não cobre.
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
  lastComment?: LastProspectCommentPreview | null;
}

export interface ProspectListFilter {
  stageId?: string;
  priority?: ProspectPriority;
  pageObjective?: PageObjective;
  origin?: ProspectOrigin;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Não deriva de `Pick<Prospect, ...>` de propósito: os campos opcionais de
 * `Prospect` são `T | null` (o que veio da API), mas aqui "não informado"
 * é sempre "não mudar esse campo" (mesma semântica do backend — ver
 * `UpdateProspectUseCase`, que só inclui em `changes` o que não é `None`).
 * `T | undefined` evita espalhar `?? null` pelos formulários só para
 * satisfazer `exactOptionalPropertyTypes`.
 */
export interface CreateProspectInput {
  stageId: string;
  companyName: string;
  niche?: string;
  mainService?: string;
  city?: string;
  neighborhood?: string;
  googleMapsUrl?: string;
  phoneRaw?: string;
  phoneType?: PhoneType;
  whatsappStatus?: WhatsappStatus;
  websiteUrl?: string;
  siteStatus?: SiteStatus;
  instagram?: string;
  contactChannel?: ContactChannel;
  email?: string;
  emailSubject?: string;
  googleRating?: number;
  googleReviewsCount?: number;
  positiveNote?: string;
  opportunity?: string;
  pageObjective?: PageObjective;
  priority?: ProspectPriority;
  origin?: ProspectOrigin;
  offeredService?: string;
  noWhatsapp?: boolean;
  // Editável direto (não só ao mover pra um estágio perdido) — pensado pro
  // caso de já ter mudado de estágio sem passar pelo prompt do board (ex.:
  // pelo seletor de estágio do próprio drawer). Ver `ProspectDrawer.tsx`.
  lossReasonId?: string;
  message1?: string;
  message2?: string;
  message3?: string;
  message4?: string;
  // P0 — data do primeiro contato. Não informado = hoje (ver backend
  // `CreateProspectUseCase`).
  initialContactDate?: string;
  targetDate?: string;
  force?: boolean;
}

export type UpdateProspectInput = Partial<CreateProspectInput>;

export type CreateProspectStageInput = Pick<ProspectStage, "name" | "color"> &
  Partial<
    Pick<
      ProspectStage,
      "isWon" | "isLost" | "asksTargetDate" | "followupBusinessDays" | "messageField"
    >
  >;

export type UpdateProspectStageInput = Partial<
  Pick<
    ProspectStage,
    | "name"
    | "color"
    | "isWon"
    | "isLost"
    | "asksTargetDate"
    | "followupBusinessDays"
    | "messageField"
  >
> & {
  // Ver backend `UpdateProspectStageCommand.clear_followup_business_days` —
  // `followupBusinessDays: null`/omitido sozinho significa "não mudar";
  // apagar a cadência de volta pra "sem cadência" exige este sinalizador.
  clearFollowupBusinessDays?: boolean;
  // Mesmo racional acima, aplicado a `messageField` (ver
  // `UpdateProspectStageCommand.clear_message_field`).
  clearMessageField?: boolean;
};

export interface ProspectDuplicateCheck {
  exists: boolean;
  prospect: Prospect | null;
}

export interface ImportRowInput {
  companyName: string;
  niche?: string;
  mainService?: string;
  city?: string;
  neighborhood?: string;
  googleMapsUrl?: string;
  phoneRaw?: string;
  phoneType?: PhoneType;
  whatsappStatus?: WhatsappStatus;
  websiteUrl?: string;
  siteStatus?: SiteStatus;
  instagram?: string;
  contactChannel?: ContactChannel;
  email?: string;
  emailSubject?: string;
  googleRating?: number;
  googleReviewsCount?: number;
  positiveNote?: string;
  opportunity?: string;
  pageObjective?: PageObjective;
  priority?: ProspectPriority;
  origin?: ProspectOrigin;
  offeredService?: string;
  noWhatsapp?: boolean;
  message1?: string;
  message2?: string;
  message3?: string;
  message4?: string;
  // P0 — data do primeiro contato dessa linha ("YYYY-MM-DD"). Não mapeado
  // = hoje no momento do import (ver backend `BulkImportProspectsUseCase`).
  initialContactDate?: string;
}

export interface ImportRowResult {
  rowIndex: number;
  outcome: "created" | "updated" | "skipped" | "error";
  companyName: string;
  detail: string | null;
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
}

/** Campos do `Prospect` que fazem sentido mapear numa importação de CSV —
 * usado pela tela de import (de/para) para montar os selects. */
export const IMPORTABLE_PROSPECT_FIELDS: { key: keyof ImportRowInput; label: string }[] = [
  { key: "companyName", label: "Nome da empresa" },
  { key: "niche", label: "Categoria/nicho" },
  { key: "mainService", label: "Serviço principal" },
  { key: "city", label: "Cidade" },
  { key: "neighborhood", label: "Bairro" },
  { key: "googleMapsUrl", label: "Link do Google Maps" },
  { key: "phoneRaw", label: "Telefone" },
  { key: "phoneType", label: "Tipo de telefone" },
  { key: "whatsappStatus", label: "Status do WhatsApp" },
  { key: "websiteUrl", label: "Site encontrado" },
  { key: "siteStatus", label: "Status do site" },
  { key: "instagram", label: "Instagram" },
  { key: "contactChannel", label: "Canal recomendado" },
  { key: "email", label: "E-mail" },
  { key: "emailSubject", label: "Assunto do e-mail" },
  { key: "googleRating", label: "Nota do Google" },
  { key: "googleReviewsCount", label: "Qtd. de avaliações" },
  { key: "positiveNote", label: "Observação positiva" },
  { key: "opportunity", label: "Oportunidade identificada" },
  { key: "pageObjective", label: "Objetivo da página" },
  { key: "priority", label: "Prioridade" },
  { key: "origin", label: "Origem" },
  { key: "initialContactDate", label: "Data do primeiro contato (P0)" },
  { key: "message1", label: "Mensagem 1" },
  { key: "message2", label: "Mensagem 2" },
  { key: "message3", label: "Mensagem 3" },
  { key: "message4", label: "Mensagem 4" },
  { key: "offeredService", label: "Serviço ofertado" },
  { key: "noWhatsapp", label: "Sem WhatsApp" },
];

export interface ProspectPriorityBreakdown {
  priority: ProspectPriority;
  count: number;
  pct: number;
}

export interface ProspectFunnelStage {
  stageId: string;
  label: string;
  color: string;
  count: number;
  pct: number;
}

export interface ProspectWeekBar {
  date: string;
  count: number;
}

export interface ProspectDashboardMetrics {
  total: number;
  today: number;
  week: number;
  month: number;
  won: number;
  open: number;
  lost: number;
  conversionRate: number;
  priorityBreakdown: ProspectPriorityBreakdown[];
  funnel: ProspectFunnelStage[];
  weekSeries: ProspectWeekBar[];
}

/** Mensagem padrão de WhatsApp por (estágio, área) — `niche: null` é
 * coringa (vale pra qualquer área daquele estágio sem template mais
 * específico). Placeholders suportados na mensagem: `{empresa}`, `{nicho}`,
 * `{servico_principal}`, `{cidade}`, `{bairro}`, `{avaliacao_google}` — ver
 * `utils/messageTemplates.ts`. */
export interface MessageTemplate {
  id: string;
  stageId: string;
  niche: string | null;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageTemplateInput {
  stageId: string;
  niche?: string;
  message: string;
}

export interface UpdateMessageTemplateInput {
  niche: string | null;
  message: string;
}

/** Motivo de perda configurável por tenant — preenchido ao mover um
 * prospect pra um estágio `isLost` (ver `ProspectionBoard.tsx`), pra
 * alimentar relatório depois. Cadastro livre em "Motivos de perda". */
export interface ProspectLossReason {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProspectLossReasonInput {
  name: string;
}

export interface UpdateProspectLossReasonInput {
  name: string;
}
