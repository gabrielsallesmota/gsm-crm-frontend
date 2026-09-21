export const ORIGIN_KEYS = [
  "landing_page",
  "whatsapp",
  "instagram",
  "facebook",
  "google",
  "manual",
  "api",
  "outro",
] as const;

export type OriginKey = (typeof ORIGIN_KEYS)[number];

export const ORIGIN: Record<OriginKey, { label: string; icon: string; color: string; bg: string }> = {
  landing_page: { label: "Landing", icon: "⚑", color: "var(--tone-green)", bg: "var(--tone-green-bg)" },
  whatsapp: { label: "WhatsApp", icon: "✆", color: "var(--tone-wa)", bg: "var(--tone-wa-bg)" },
  instagram: { label: "Instagram", icon: "◎", color: "var(--tone-pink)", bg: "var(--tone-pink-bg)" },
  facebook: { label: "Facebook", icon: "f", color: "var(--tone-blue)", bg: "var(--tone-blue-bg)" },
  google: { label: "Google", icon: "G", color: "var(--tone-amber)", bg: "var(--tone-amber-bg)" },
  manual: { label: "Manual", icon: "✎", color: "var(--tone-gray)", bg: "var(--tone-gray-bg)" },
  api: { label: "API", icon: "⌁", color: "var(--tone-purple)", bg: "var(--tone-purple-bg)" },
  outro: { label: "Outro", icon: "•", color: "var(--tone-gray-2)", bg: "var(--tone-gray-2-bg)" },
};

export function originOf(key: string): { label: string; icon: string; color: string; bg: string } {
  return (ORIGIN as Record<string, (typeof ORIGIN)[OriginKey]>)[key] ?? ORIGIN.outro;
}
