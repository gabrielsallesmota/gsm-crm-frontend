export function daysAgo(n: number): string {
  const dt = new Date();
  dt.setHours(9, 0, 0, 0);
  dt.setDate(dt.getDate() - n);
  return dt.toISOString();
}

export function daysFromNow(n: number): string {
  return daysAgo(-n);
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

export function weekdayShortLabel(iso: string): string {
  const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return names[new Date(iso).getDay()] ?? "";
}

export function relativeDayLabel(iso: string): string {
  const diff = Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long" });
}

export function shortDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function shortTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
