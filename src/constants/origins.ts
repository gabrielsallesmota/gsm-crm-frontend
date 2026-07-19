export const ORIGIN_KEYS = [
  "landingpage",
  "whatsapp",
  "instagram",
  "facebook",
  "google",
  "manual",
] as const;

export type OriginKey = (typeof ORIGIN_KEYS)[number];

export const ORIGIN: Record<OriginKey, { label: string; icon: string; color: string; bg: string }> = {
  landingpage: { label: "Landing", icon: "⚑", color: "#2ee66e", bg: "rgba(46,230,110,.12)" },
  whatsapp: { label: "WhatsApp", icon: "✆", color: "#25d366", bg: "rgba(37,211,102,.12)" },
  instagram: { label: "Instagram", icon: "◎", color: "#e1719c", bg: "rgba(225,48,108,.14)" },
  facebook: { label: "Facebook", icon: "f", color: "#4aa3ff", bg: "rgba(74,163,255,.14)" },
  google: { label: "Google", icon: "G", color: "#f5b13d", bg: "rgba(245,177,61,.14)" },
  manual: { label: "Manual", icon: "✎", color: "#9aa6b2", bg: "rgba(255,255,255,.06)" },
};

export function originOf(key: string): { label: string; icon: string; color: string; bg: string } {
  return (ORIGIN as Record<string, (typeof ORIGIN)[OriginKey]>)[key] ?? ORIGIN.manual;
}
