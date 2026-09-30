import type { AiApiProvider, AiChatTarget } from "../types/sdr";

/**
 * Para onde o botão "Copiar prompt" leva (fluxo sem API key). O prompt vai
 * SEMPRE para a área de transferência; ChatGPT e Claude também aceitam o
 * texto na URL (`?q=`) e já abrem com ele preenchido. O Manus não tem esse
 * atalho — abre a tela inicial e a pessoa cola.
 */
export const AI_CHAT_TARGET_LABEL: Record<AiChatTarget, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  manus: "Manus",
};

export const AI_API_PROVIDER_LABEL: Record<AiApiProvider, string> = {
  openai: "OpenAI (ChatGPT)",
  anthropic: "Claude (Anthropic)",
};

// URL muito longa é cortada por navegador/proxy: acima disso, só abre o
// site e a pessoa cola (o prompt já está copiado).
const MAX_PREFILL_URL_LENGTH = 7000;

const BASE_URL: Record<AiChatTarget, string> = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  manus: "https://manus.im/app",
};

export function aiChatUrl(target: AiChatTarget, prompt: string): string {
  const base = BASE_URL[target];
  if (target === "manus") return base;
  const prefilled = `${base}?q=${encodeURIComponent(prompt)}`;
  return prefilled.length <= MAX_PREFILL_URL_LENGTH ? prefilled : base;
}
