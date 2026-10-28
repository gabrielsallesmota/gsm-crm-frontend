/** Instagram Direct → Lead: tipos e regras de exibição (puro, sem chamadas de API). */

/** Conta profissional do Instagram conectada pela empresa (sem token: ele nunca sai do backend). */
export interface InstagramAccount {
  username: string | null;
  accountType: string | null;
  status: "active" | "needs_reconnect" | "disconnected";
  receiving: boolean;
  tokenExpiresAt: string | null;
  lastWebhookAt: string | null;
  error: string | null;
  connectedAt: string;
}

export interface InstagramStatus {
  configured: boolean;
  account: InstagramAccount | null;
}

/** Situação da conexão em uma frase (o que a pessoa precisa saber/fazer). */
export function describeInstagram(account: InstagramAccount): { tone: "ok" | "warn" | "bad"; label: string } {
  if (account.status === "needs_reconnect") return { tone: "bad", label: "Precisa reconectar" };
  if (!account.receiving) return { tone: "warn", label: "Conectada, mas sem receber Directs" };
  return { tone: "ok", label: "Recebendo Directs" };
}

