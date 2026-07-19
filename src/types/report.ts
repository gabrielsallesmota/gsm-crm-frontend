export interface ReportBar {
  label: string;
  widthPct: string;
  value: string;
  color: string;
}

export interface ReportCard {
  title: string;
  subtitle: string;
  bars: ReportBar[];
}
