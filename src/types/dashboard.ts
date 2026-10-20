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
  /** Soma do valor esperado dos leads da etapa, já formatada (ex.: "R$ 4,5k"). */
  valueLabel?: string;
  /** Leads da etapa sem valor informado (entram como R$ 0 na soma). */
  withoutValue?: number;
}

export interface WeekBar {
  day: string;
  count: number;
  heightPct: string;
  isToday: boolean;
}

/** Lead em andamento sem interação há `days` dias. */
export interface StalledLead {
  id: string;
  name: string;
  days: number;
}

export interface OwnerStat {
  ownerId: string | null;
  total: number;
  open: number;
  closed: number;
  lost: number;
  closedRevenue: number;
}

/** Mesmos números do período anterior de igual duração (só com período filtrado). */
export interface PreviousPeriod {
  dateFrom: string;
  dateTo: string;
  totalLeads: number;
  closed: number;
  lost: number;
  conversionRate: number;
  closedRevenue: number;
}

/** O que pede ação agora — independe do período filtrado. */
export interface Attention {
  tasksOverdue: number;
  tasksToday: number;
  stalledLeads: number;
  renewalsNext30Days: number;
  clientsOverdue: number;
}

export const NO_ATTENTION: Attention = {
  tasksOverdue: 0,
  tasksToday: 0,
  stalledLeads: 0,
  renewalsNext30Days: 0,
  clientsOverdue: 0,
};

export interface DashboardMetrics {
  totalLeads: number;
  today: number;
  week: number;
  month: number;
  closed: number;
  conversionRate: number;
  forecastRevenue: number;
  closedRevenue: number;
  avgCloseDays: number | null;
  open: number;
  lost: number;
  originLegend: OriginLegendItem[];
  funnel: FunnelStage[];
  weekSeries: WeekBar[];
  openWithoutValue: number;
  wonWithoutValue: number;
  stalled: StalledLead[];
  owners: OwnerStat[];
  previous: PreviousPeriod | null;
  attention: Attention;
}
