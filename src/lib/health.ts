import type { HealthTracking } from '@/types/personal';

export type Reading = { at: number; value: number };

export type TrendPoint = Reading & { readings: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export function distinctMetrics(entries: Pick<HealthTracking, 'metric'>[]) {
  return [...new Set(entries.map((entry) => entry.metric))].sort();
}

export function readingsFor(
  entries: Pick<HealthTracking, 'metric' | 'value' | 'createdAt'>[],
  metric: string,
  days: number | null,
  now = Date.now()
): Reading[] {
  const cutoff = days === null ? -Infinity : now - days * DAY_MS;
  return entries
    .filter((entry) => entry.metric === metric)
    .map((entry) => ({ at: new Date(entry.createdAt).getTime(), value: entry.value }))
    .filter((reading) => Number.isFinite(reading.at) && reading.at >= cutoff)
    .sort((a, b) => a.at - b.at);
}

export function weeklyAverages(readings: Reading[]): TrendPoint[] {
  const buckets = new Map<number, { total: number; readings: number }>();

  for (const reading of readings) {
    const start = weekStart(reading.at);
    const bucket = buckets.get(start) ?? { total: 0, readings: 0 };
    buckets.set(start, { total: bucket.total + reading.value, readings: bucket.readings + 1 });
  }

  return [...buckets]
    .map(([at, bucket]) => ({ at, value: bucket.total / bucket.readings, readings: bucket.readings }))
    .sort((a, b) => a.at - b.at);
}

export function weekStart(at: number) {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

export function trendSummary(readings: Reading[]) {
  if (!readings.length) return null;
  const first = readings[0];
  const last = readings[readings.length - 1];
  return {
    latest: last.value,
    change: last.value - first.value,
    average: readings.reduce((total, reading) => total + reading.value, 0) / readings.length,
    spanMs: last.at - first.at,
  };
}

export function formatReading(value: number) {
  return Number(value.toFixed(3)).toLocaleString();
}
