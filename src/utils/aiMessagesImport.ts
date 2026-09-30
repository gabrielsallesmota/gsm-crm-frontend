/**
 * Import da resposta de uma IA externa (ChatGPT, Claude…) para as Mensagens
 * 1–4 de um Prospect — par do prompt gerado pelo backend
 * (`app/modules/sdr/domain/ai_prompt.py`), que pede este JSON:
 *
 *   {"oportunidade": "...", "mensagens": ["...", "...", "...", "..."]}
 *
 * O parser é tolerante porque a IA nem sempre obedece: aceita a resposta
 * dentro de cercas ```json, com texto antes/depois, só o array de mensagens,
 * objetos `{texto: ...}` no lugar de strings, ou chaves `mensagem_1..4`.
 */

export const MAX_IMPORTED_MESSAGES = 4;
export const MAX_IMPORTED_MESSAGE_LENGTH = 2000;

export interface ImportedAiMessages {
  opportunity: string;
  messages: string[];
}

export type AiMessagesParseResult =
  | { ok: true; value: ImportedAiMessages }
  | { ok: false; error: string };

const LIST_KEYS = ["mensagens", "messages", "follow_ups", "followups", "follow-ups"];
const TEXT_KEYS = ["texto", "text", "mensagem", "message", "conteudo", "content"];
const OPPORTUNITY_KEYS = ["oportunidade", "opportunity"];

function extractJson(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const text = (fenced?.[1] ?? raw).trim();
  const starts = [text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0);
  if (starts.length === 0) return null;
  const start = Math.min(...starts);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  return end > start ? text.slice(start, end + 1) : null;
}

function asText(item: unknown): string | null {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      if (typeof record[key] === "string") return record[key];
    }
  }
  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value.trim();
  }
  return "";
}

function numberedMessages(record: Record<string, unknown>): unknown[] | null {
  const found: unknown[] = [];
  for (let n = 1; n <= MAX_IMPORTED_MESSAGES; n++) {
    const key = [`mensagem_${n}`, `mensagem${n}`, `message_${n}`, `message${n}`].find(
      (k) => k in record,
    );
    if (key) found.push(record[key]);
  }
  return found.length > 0 ? found : null;
}

export function parseAiMessages(raw: string): AiMessagesParseResult {
  if (!raw.trim()) return { ok: false, error: "Cole a resposta da IA." };
  const json = extractJson(raw);
  if (json === null) {
    return { ok: false, error: "Não encontrei um JSON na resposta. Cole a resposta inteira da IA." };
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: "O JSON da resposta está inválido (confira aspas e vírgulas)." };
  }

  let opportunity = "";
  let items: unknown[] | null = null;
  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    opportunity = pickString(record, OPPORTUNITY_KEYS);
    const listKey = LIST_KEYS.find((k) => Array.isArray(record[k]));
    items = listKey ? (record[listKey] as unknown[]) : numberedMessages(record);
  }
  if (!items) {
    return { ok: false, error: 'O JSON não tem a lista "mensagens".' };
  }

  const texts = items.map(asText);
  if (texts.some((t) => t === null)) {
    return { ok: false, error: "Todas as mensagens precisam ser texto." };
  }
  const messages = (texts as string[]).map((t) => t.trim()).filter(Boolean);
  if (messages.length === 0) {
    return { ok: false, error: "A resposta não tem nenhuma mensagem preenchida." };
  }
  if (messages.length > MAX_IMPORTED_MESSAGES) {
    return {
      ok: false,
      error: `A resposta tem ${messages.length} mensagens; o máximo é ${MAX_IMPORTED_MESSAGES}.`,
    };
  }
  const tooLong = messages.findIndex((m) => m.length > MAX_IMPORTED_MESSAGE_LENGTH);
  if (tooLong >= 0) {
    return {
      ok: false,
      error: `A mensagem ${tooLong + 1} passa de ${MAX_IMPORTED_MESSAGE_LENGTH} caracteres.`,
    };
  }
  return { ok: true, value: { opportunity, messages } };
}
