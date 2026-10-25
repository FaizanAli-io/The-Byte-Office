import { z } from 'zod/v4';
import { NAMAAZ_VALUES } from '@/types/personal';

const namaazSchema = z.enum(NAMAAZ_VALUES, {
  error: `Namaaz must be one of: ${NAMAAZ_VALUES.join(', ')}`,
});

const missed = z
  .int({ error: 'Missed must be a non-negative integer' })
  .min(0, 'Missed must be a non-negative integer');
const metric = z.string({ error: 'Metric is required' }).trim().min(1, 'Metric is required');
const metricId = z.uuid({ error: 'metricId must be a health metric id' });
const reading = z.number({ error: 'Value must be a number' }).finite('Value must be a number');
const createdAt = z.coerce.date({ error: 'createdAt must be a valid date' });

const hasAnyField = (value: object) => Object.values(value).some((field) => field !== undefined);

// A test write changes the count but leaves no prayer history entry, so the history holds only real changes.
export const prayerTestFlag = z
  .boolean({ error: 'test must be true or false' })
  .default(false)
  .describe('Defaults to false. Only true for a test run: the count changes, but no prayer history entry is written');

export const prayerSetSchema = z.object({ namaaz: namaazSchema, missed, test: prayerTestFlag });

export const healthInputSchema = z.object({ metricId, value: reading, createdAt: createdAt.optional() });

export const healthUpdateSchema = z
  .object({ metricId: metricId.optional(), value: reading.optional(), createdAt: createdAt.optional() })
  .refine(hasAnyField, { error: 'Provide metricId, value, or createdAt to update' });

export const healthByNameSchema = z.object({ metric, value: reading, createdAt: createdAt.optional() });

export const healthUpdateByNameSchema = z
  .object({ metric: metric.optional(), value: reading.optional(), createdAt: createdAt.optional() })
  .refine(hasAnyField, { error: 'Provide metric, value, or createdAt to update' });

export const healthMetricInputSchema = z.object({ name: metric });

export const healthMetricUpdateSchema = z.object({ id: z.string().min(1), name: metric });

// An input, so `test` may be left out and counts as false.
export type PrayerSet = z.input<typeof prayerSetSchema>;
export type HealthTrackingInput = z.infer<typeof healthInputSchema>;
export type HealthTrackingUpdate = z.infer<typeof healthUpdateSchema>;
