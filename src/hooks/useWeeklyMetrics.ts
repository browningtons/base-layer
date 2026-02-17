import { useEffect, useState } from 'react';
import type { Category, Metric } from '../types';
import { autoThresholds } from '../utils/scoring';

const STORAGE_PREFIX = 'base-layer:weekly';

const getStorageKey = (category: Category, weekKey: string) =>
  `${STORAGE_PREFIX}:${category}:${weekKey}`;

const readWeeklyMetrics = (category: Category, weekKey: string, defaults: Metric[]) => {
  if (typeof window === 'undefined') {
    return defaults;
  }

  const raw = window.localStorage.getItem(getStorageKey(category, weekKey));
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<Metric>>;
    if (!Array.isArray(parsed)) {
      return defaults;
    }

    const storedById = new Map(parsed.map(metric => [metric.id, metric]));

    return defaults.map(defaultMetric => {
      const stored = storedById.get(defaultMetric.id);
      if (!stored) {
        return defaultMetric;
      }

      const current = Number(stored.current);
      const weak = Number(stored.weak);
      const elite = Number(stored.elite);

      if (!Number.isFinite(current) || !Number.isFinite(weak) || !Number.isFinite(elite)) {
        return defaultMetric;
      }

      return autoThresholds({ ...defaultMetric, current, weak, elite });
    });
  } catch {
    return defaults;
  }
};

const writeWeeklyMetrics = (category: Category, weekKey: string, metrics: Metric[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getStorageKey(category, weekKey), JSON.stringify(metrics));
};

export const useWeeklyMetrics = (
  category: Category,
  weekKey: string,
  defaults: Metric[]
) => {
  const [metrics, setMetrics] = useState<Metric[]>(() =>
    readWeeklyMetrics(category, weekKey, defaults)
  );

  useEffect(() => {
    setMetrics(readWeeklyMetrics(category, weekKey, defaults));
  }, [category, weekKey, defaults]);

  useEffect(() => {
    writeWeeklyMetrics(category, weekKey, metrics);
  }, [category, weekKey, metrics]);

  return [metrics, setMetrics] as const;
};
