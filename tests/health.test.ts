import { describe, expect, it } from 'vitest';
import { distinctMetrics, readingsFor, trendSummary, weekStart, weeklyAverages } from '@/lib/health';

const entry = (metric: string, value: number, createdAt: string) => ({
  metric,
  value,
  createdAt: new Date(createdAt),
});

describe('distinctMetrics', () => {
  it('lists each metric once, sorted', () => {
    const entries = [
      entry('weight_kg', 80, '2026-03-01'),
      entry('steps', 9000, '2026-03-02'),
      entry('weight_kg', 79, '2026-03-03'),
    ];
    expect(distinctMetrics(entries)).toEqual(['steps', 'weight_kg']);
  });

  it('treats a typo as its own metric, because nothing says otherwise', () => {
    expect(distinctMetrics([entry('weight_kg', 1, '2026-03-01'), entry('weight-kg', 1, '2026-03-02')])).toEqual([
      'weight-kg',
      'weight_kg',
    ]);
  });
});

describe('readingsFor', () => {
  const now = new Date('2026-03-31T12:00:00Z').getTime();
  const entries = [
    entry('weight_kg', 82, '2026-01-05T09:00:00Z'),
    entry('weight_kg', 80, '2026-03-10T09:00:00Z'),
    entry('steps', 9000, '2026-03-11T09:00:00Z'),
    entry('weight_kg', 79, '2026-03-20T09:00:00Z'),
  ];

  it('keeps only the chosen metric, oldest first', () => {
    expect(readingsFor(entries, 'weight_kg', null, now).map((reading) => reading.value)).toEqual([82, 80, 79]);
  });

  it('drops readings older than the window', () => {
    expect(readingsFor(entries, 'weight_kg', 30, now).map((reading) => reading.value)).toEqual([80, 79]);
  });

  it('keeps everything when the window is open-ended', () => {
    expect(readingsFor(entries, 'weight_kg', null, now)).toHaveLength(3);
  });

  it('is empty for a metric that was never recorded', () => {
    expect(readingsFor(entries, 'glucose', null, now)).toEqual([]);
  });
});

describe('weekStart', () => {
  it('rolls back to the Monday that began the week', () => {
    // Local time throughout, because that is the week the reader lived in.
    const wednesday = new Date(2026, 2, 11, 15, 30).getTime();
    expect(new Date(weekStart(wednesday)).getDay()).toBe(1);
  });

  it('treats Sunday as the end of the week it began, not the start of the next', () => {
    const sunday = new Date(2026, 2, 15, 9, 0).getTime();
    const thursdayBefore = new Date(2026, 2, 12, 9, 0).getTime();
    expect(weekStart(sunday)).toBe(weekStart(thursdayBefore));
  });
});

describe('weeklyAverages', () => {
  const reading = (date: [number, number, number], value: number) => ({
    at: new Date(date[0], date[1], date[2], 9).getTime(),
    value,
  });

  it('averages the readings inside each week and counts them', () => {
    const points = weeklyAverages([
      reading([2026, 2, 9], 80), // Monday
      reading([2026, 2, 11], 82), // Wednesday, same week
      reading([2026, 2, 16], 78), // the following Monday
    ]);

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ value: 81, readings: 2 });
    expect(points[1]).toMatchObject({ value: 78, readings: 1 });
  });

  it('returns buckets oldest first whatever order they arrived in', () => {
    const points = weeklyAverages([reading([2026, 2, 16], 1), reading([2026, 2, 9], 2)]);
    expect(points[0].at).toBeLessThan(points[1].at);
  });

  it('is empty for no readings', () => {
    expect(weeklyAverages([])).toEqual([]);
  });
});

describe('trendSummary', () => {
  const readings = [
    { at: 1000, value: 82 },
    { at: 2000, value: 80 },
    { at: 3000, value: 78 },
  ];

  it('reports where the line ended, how far it moved and its mean', () => {
    expect(trendSummary(readings)).toEqual({ latest: 78, change: -4, average: 80, spanMs: 2000 });
  });

  it('has nothing to say about no readings', () => {
    expect(trendSummary([])).toBeNull();
  });

  it('reports no change for a single reading', () => {
    expect(trendSummary([{ at: 1000, value: 5 }])).toMatchObject({ latest: 5, change: 0, spanMs: 0 });
  });
});
