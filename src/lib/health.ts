import type { HealthTracking } from '@/types/personal';

/**
 * The arithmetic behind the health trend chart, kept out of the component so
 * it can be tested without rendering anything — the same split the ledger and
 * portfolio totals already use.
 *
 * Readings are timestamps and numbers here rather than rows, because that is
 * all the shaping needs and it keeps the date parsing in one place.
 */

export type Reading = { at: number; value: number };

/** A plotted point. `readings` is 1 for a raw point and the bucket size for an average. */
export type TrendPoint = Reading & { readings: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Free-text metrics, so the list is whatever has actually been recorded. */
export function distinctMetrics(entries: Pick<HealthTracking, 'metric'>[]) {
  return [...new Set(entries.map((entry) => entry.metric))].sort();
}

/**
 * One metric's readings inside a window, oldest first. A null `days` means
 * every reading. `now` is injected so the window is testable.
 */
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

/**
 * Averages readings into weekly buckets, each plotted at the Monday that
 * starts its week. Smoothing is what makes a noisy daily metric readable;
 * the bucket size travels with the point so a tooltip can say how many
 * readings it stands for.
 */
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
  // getDay() is 0 on Sunday, which belongs to the week that began six days earlier.
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

/** What a trend line is actually read for: where it ended, how far it moved, and its middle. */
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

/** Readings hold up to three decimals, but trailing zeros are noise. */
export function formatReading(value: number) {
  return Number(value.toFixed(3)).toLocaleString();
}
