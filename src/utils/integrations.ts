// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type {
  ApiCredential,
  AttemptOutcome,
  DeliveryAttempt,
  DeliveryStatus,
  WebhookEndpoint,
} from "../types/integrations.ts";

/** Regras puras da tela de Integrações (Etapa 3) — testadas em
 * `tests/integrations.test.ts`. Só apresentação/validação de formulário: a
 * autoridade sobre scopes, eventos e URLs é o backend (422 se discordar). */

export type Tone = "ok" | "warn" | "bad" | "neutral";

export function toggleItem(list: readonly string[], item: string): string[] {
  return list.includes(item) ? list.filter((s) => s !== item) : [...list, item];
}

export type ExpirationChoice = "never" | "30" | "90" | "180" | "365";

export const EXPIRATION_OPTIONS: { value: ExpirationChoice; label: string }[] = [
  { value: "never", label: "Sem expiração" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "180", label: "180 dias" },
  { value: "365", label: "1 ano" },
];

export function expirationToIso(choice: ExpirationChoice, now: Date = new Date()): string | null {
  if (choice === "never") return null;
  return new Date(now.getTime() + Number(choice) * 86_400_000).toISOString();
}

export function validateCredentialDraft(name: string, scopes: readonly string[]): string | null {
  if (!name.trim()) return "Dê um nome para identificar a integração (ex.: n8n Instagram).";
  if (name.trim().length > 200) return "Nome muito longo (máx. 200 caracteres).";
  if (scopes.length === 0) return "Escolha ao menos uma permissão.";
  return null;
}

export function credentialState(c: ApiCredential): { label: string; tone: Tone } {
  if (c.status === "revoked") return { label: "Revogada", tone: "bad" };
  if (c.expired) return { label: "Expirada", tone: "bad" };
  if (c.previousSecretValidUntil) return { label: "Em rotação", tone: "warn" };
  return { label: "Ativa", tone: "ok" };
}

export function canManageCredential(c: ApiCredential): boolean {
  return c.status === "active";
}

export const GRACE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Invalidar o secret atual agora" },
  { value: 1, label: "Manter o atual por 1 hora" },
  { value: 24, label: "Manter o atual por 24 horas" },
  { value: 72, label: "Manter o atual por 72 horas" },
];

/** Validação local de URL (UX). A proteção real contra SSRF — IP privado,
 * metadata de nuvem, DNS apontando para rede interna — é do backend. */
export function validateWebhookDraft(url: string, events: readonly string[]): string | null {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Informe uma URL completa, começando com https://";
  }
  if (parsed.protocol !== "https:") return "A URL precisa usar https://";
  if (parsed.username || parsed.password) return "A URL não pode conter usuário/senha.";
  if (events.length === 0) return "Escolha ao menos um evento.";
  return null;
}

export function webhookState(w: WebhookEndpoint): { label: string; tone: Tone } {
  if (w.status === "disabled") return { label: "Desativado", tone: "bad" };
  if (w.status === "paused") return { label: "Pausado", tone: "neutral" };
  if (w.consecutiveFailures > 0) return { label: "Com falhas", tone: "warn" };
  return { label: "Ativo", tone: "ok" };
}

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: "Na fila",
  delivering: "Enviando",
  succeeded: "Entregue",
  retrying: "Nova tentativa agendada",
  failed: "Falhou",
};

export function deliveryTone(status: string): Tone {
  if (status === "succeeded") return "ok";
  if (status === "failed") return "bad";
  if (status === "retrying") return "warn";
  return "neutral";
}

export function deliveryStatusLabel(status: string): string {
  return DELIVERY_STATUS_LABEL[status as DeliveryStatus] ?? status;
}

const OUTCOME_LABEL: Record<AttemptOutcome, string> = {
  success: "Sucesso",
  http_error: "Erro HTTP",
  timeout: "Tempo esgotado",
  connection_error: "Falha de conexão",
  blocked: "Bloqueado (URL não permitida)",
};

/** Resultado de uma tentativa em uma linha: "HTTP 500 · Erro HTTP · 120 ms". */
export function describeAttempt(a: DeliveryAttempt): string {
  const parts: string[] = [];
  if (a.statusCode !== null) parts.push(`HTTP ${a.statusCode}`);
  parts.push(OUTCOME_LABEL[a.outcome] ?? a.outcome);
  if (a.durationMs !== null) parts.push(`${a.durationMs} ms`);
  return parts.join(" · ");
}

/** "HTTP 200", "timeout", "—" — resumo da última tentativa na lista. */
export function lastResultLabel(statusCode: number | null, error: string | null): string {
  if (statusCode !== null) return `HTTP ${statusCode}`;
  if (error) return error.length > 60 ? `${error.slice(0, 57)}…` : error;
  return "—";
}
