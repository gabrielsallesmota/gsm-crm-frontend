type IconName =
  | "leads"
  | "today"
  | "week"
  | "month"
  | "closed"
  | "conversion"
  | "forecast"
  | "revenue"
  | "firstContact"
  | "closeTime"
  | "open"
  | "lost";

interface IconDef {
  d: string;
  dotCx?: number;
  dotCy?: number;
}

const ICONS: Record<IconName, IconDef> = {
  leads: { d: "M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 20c0-3.2 2.2-5.2 5-5.2s5 2 5 5.2M17 9.5a2.1 2.1 0 1 0 0-4.2M15.3 20c.3-2.1 1.7-3.5 3.4-3.8" },
  today: { d: "M4 13h4l1.8 2.6h4.4L16 13h4M4 13v5.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V13M12 3v8M8.5 8.2 12 11.8l3.5-3.6" },
  week: { d: "M3.5 5h17v15h-17zM3.5 9.5h17M8 3v4M16 3v4M7.5 13.5h2.5M7.5 16.5h2.5M13.5 13.5h3M13.5 16.5h3" },
  month: { d: "M3.5 5h17v15h-17zM3.5 9.5h17M8 3v4M16 3v4", dotCx: 12, dotCy: 15 },
  closed: { d: "M12 20.3a8.3 8.3 0 1 0 0-16.6 8.3 8.3 0 0 0 0 16.6zM8.2 12.3l2.6 2.6 5-5.2" },
  conversion: { d: "M4 16.5 9.2 11l3.6 3.6L20 7M14.4 7H20v5.6" },
  forecast: { d: "M5 20V10M12 20V4M19 20v-7M3 20h18" },
  revenue: { d: "M3.5 6.5h17v12h-17zM3.5 10.5h17", dotCx: 16.3, dotCy: 14.5 },
  firstContact: { d: "M12 20.5a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 8.2v4.6l3 2M9 2.5h6" },
  closeTime: { d: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4z", dotCx: 12, dotCy: 12 },
  open: { d: "M4.5 12a7.5 7.5 0 0 1 12.8-5.3L20 9.3M20 4.8v4.5h-4.5M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4 14.7M4 19.2v-4.5h4.5" },
  lost: { d: "M4 8.2 9.2 13.5l3.6-3.5L20 17M14.4 17H20v-5.6" },
};

export function KpiIcon({ name }: { name: IconName }) {
  const icon = ICONS[name];
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={icon.d} />
      {icon.dotCx != null && <circle cx={icon.dotCx} cy={icon.dotCy} r={1.5} fill="currentColor" stroke="none" />}
    </svg>
  );
}
