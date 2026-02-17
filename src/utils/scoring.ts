import type { Metric, MetricInput } from '../types';

export const autoThresholds = (baseMetric: MetricInput | Metric): Metric => {
  const { weak, elite } = baseMetric;
  const range = elite - weak;

  const round = (num: number) => {
    if (Math.abs(num) >= 100) {
      return Math.round(num / 10) * 10;
    }
    return Math.round(num);
  };

  return {
    ...baseMetric,
    avg: round(weak + range * 0.33),
    goal: round(weak + range * 0.66)
  };
};

export const getWeekKey = (date: Date | string | number = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday start
  return d.toISOString().slice(0, 10);
};

export const weekKeyToInputValue = (weekKey: string) => {
  const d = new Date(weekKey);
  const year = d.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

export const weekInputToWeekKey = (weekInput: string) => {
  const [yearText, weekText] = weekInput.split('-W');
  const year = Number(yearText);
  const week = Number(weekText);

  if (!Number.isFinite(year) || !Number.isFinite(week)) {
    return null;
  }

  const d = new Date(year, 0, 1 + (week - 1) * 7);
  return getWeekKey(d);
};

export const normalize = (metric: Pick<Metric, 'weak' | 'elite' | 'type'>, value: number) => {
  const { weak, elite, type } = metric;
  const val = Number.isFinite(value) ? value : 0;
  const w = Number.isFinite(weak) ? weak : 0;
  const e = Number.isFinite(elite) ? elite : 0;

  if (w === e) return 0;

  if (type === 'lower_better') {
    const min = e;
    const max = w;
    const clamped = Math.min(Math.max(val, min), max);
    return (max - clamped) / (max - min);
  }

  const min = w;
  const max = e;
  const clamped = Math.min(Math.max(val, min), max);
  return (clamped - min) / (max - min);
};

export const getVisualRadius = (normalizedValue: number) => {
  if (normalizedValue <= 0.33) return 0.05 + (normalizedValue / 0.33) * 0.55;
  if (normalizedValue <= 0.66) return 0.60 + ((normalizedValue - 0.33) / 0.33) * 0.20;
  return 0.80 + ((normalizedValue - 0.66) / 0.34) * 0.20;
};

export const calculateCategoryScore = (metricsList: Metric[]) => {
  if (!metricsList || metricsList.length === 0) return 0;

  const totalProgress = metricsList.reduce((acc, metric) => {
    const norm = normalize(metric, metric.current);
    const validNorm = Number.isFinite(norm) ? norm : 0;
    return acc + (validNorm / 0.66) * 100;
  }, 0);

  return Math.round(totalProgress / metricsList.length);
};
