export type MetricType = 'higher_better' | 'lower_better';
export type Category = 'body' | 'mind' | 'family' | 'social';
export type ActiveTab = 'overview' | Category;
export type OverviewMode = 'sunburst' | 'triangle';
export type MetricRank = 0 | 1 | 2 | 3;
export type EditableMetricField = 'current' | 'weak' | 'elite';

export interface MetricInput {
  id: string;
  label: string;
  unit: string;
  current: number;
  weak: number;
  elite: number;
  type: MetricType;
  desc: string;
  tip: string;
}

export interface Metric extends MetricInput {
  avg: number;
  goal: number;
}

export interface OverviewDatum {
  id: Category;
  label: string;
  current: number;
  elite: number;
  color: string;
}

export interface HoveredPoint {
  x: number;
  y: number;
  val: number;
  unit: string;
  label: string;
  color?: string;
}

export interface CategoryScoreSummary {
  body: number;
  mind: number;
  family: number;
  social: number;
  level: number;
  data: OverviewDatum[];
}
