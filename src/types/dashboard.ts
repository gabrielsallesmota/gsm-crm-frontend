export interface OriginLegendItem {
  key: string;
  label: string;
  color: string;
  count: number;
  pct: string;
}

export interface FunnelStage {
  key: string;
  label: string;
  color: string;
  count: number;
  widthPct: string;
  pct: string;
}

export interface WeekBar {
  day: string;
  count: number;
  heightPct: string;
  isToday: boolean;
}

export interface DashboardMetrics {
  totalLeads: number;
  today: number;
  week: number;
  month: number;
  closed: number;
  conversionRate: number;
  forecastRevenue: number;
  closedRevenue: number;
  avgFirstContactHours: number;
  avgCloseDays: number | null;
  open: number;
  lost: number;
  originLegend: OriginLegendItem[];
  funnel: FunnelStage[];
  weekSeries: WeekBar[];
}
