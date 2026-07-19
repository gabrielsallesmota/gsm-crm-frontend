export function initials(name: string): string {
  const parts = (name || "").replace(/[^A-Za-zÀ-ÿ ]/g, "").trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "?";
}
