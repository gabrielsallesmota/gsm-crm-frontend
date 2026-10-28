import { apiRequest } from "../repositories/api/ApiClient";
import { isDemoMode } from "./factory";
import type { InstagramAccount, InstagramStatus } from "../utils/instagram";

export type { InstagramAccount, InstagramStatus } from "../utils/instagram";
export { describeInstagram } from "../utils/instagram";

type Dto = Record<string, unknown>;
const P = "/api/v1/instagram";
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function toAccount(d: Dto): InstagramAccount {
  const status = str(d.status);
  return {
    username: str(d.username),
    accountType: str(d.account_type),
    status: status === "needs_reconnect" || status === "disconnected" ? status : "active",
    receiving: d.receiving === true,
    tokenExpiresAt: str(d.token_expires_at),
    lastWebhookAt: str(d.last_webhook_at),
    error: str(d.error),
    connectedAt: str(d.connected_at) ?? "",
  };
}

export const instagramService = {
  async status(): Promise<InstagramStatus> {
    if (isDemoMode) return { configured: false, account: null };
    const d = await apiRequest<Dto>(P);
    return {
      configured: d.configured === true,
      account: d.account && typeof d.account === "object" ? toAccount(d.account as Dto) : null,
    };
  },

  async authorize(): Promise<string> {
    const d = await apiRequest<Dto>(`${P}/authorize`, { method: "POST" });
    const url = str(d.authorization_url);
    if (!url) throw new Error("O servidor não devolveu o endereço de autorização.");
    return url;
  },

  async complete(input: { state: string; code?: string; error?: string }): Promise<InstagramAccount> {
    const d = await apiRequest<Dto>(`${P}/callback`, { method: "POST", body: JSON.stringify(input) });
    return toAccount(d);
  },

  async disconnect(): Promise<void> {
    await apiRequest<void>(P, { method: "DELETE" });
  },
};
