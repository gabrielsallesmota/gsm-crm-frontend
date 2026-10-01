import type { ProspectContactMethod, ProspectMessageField, ProspectStage } from "../types/prospect";

/**
 * Cadência padrão de prospecção (igual ao backend, `sdr/domain/cadence.py`):
 * D1 WhatsApp, D2 ligação, D4 WhatsApp, D7 ligação, D10 WhatsApp — uma etapa
 * por campo de mensagem (`message_1`..`message_5`).
 */
export const DEFAULT_CADENCE: { day: number; channel: ProspectContactMethod }[] = [
  { day: 1, channel: "whatsapp" },
  { day: 2, channel: "ligacao" },
  { day: 4, channel: "whatsapp" },
  { day: 7, channel: "ligacao" },
  { day: 10, channel: "whatsapp" },
];

export function defaultChannelForField(
  field: ProspectMessageField | null | undefined,
): ProspectContactMethod {
  if (!field) return "whatsapp";
  const index = Number(field.replace("message_", "")) - 1;
  return DEFAULT_CADENCE[index]?.channel ?? "whatsapp";
}

/** Canal que vale para o estágio: o escolhido nele, ou o padrão da
 * cadência para o campo de mensagem que ele usa (`contactMethod: null`). */
export function effectiveContactMethod(
  stage: Pick<ProspectStage, "contactMethod" | "messageField"> | undefined,
): ProspectContactMethod {
  if (!stage) return "whatsapp";
  return stage.contactMethod ?? defaultChannelForField(stage.messageField);
}

/** Dia e canal da etapa `index` (0-based) para os estágios configurados. */
export function cadenceStep(index: number, stages: ProspectStage[]) {
  const fallback = DEFAULT_CADENCE[index] ?? { day: index + 1, channel: "whatsapp" as const };
  const stage = stages.find((s) => s.messageField === `message_${index + 1}`);
  return { day: fallback.day, channel: stage?.contactMethod ?? fallback.channel };
}
