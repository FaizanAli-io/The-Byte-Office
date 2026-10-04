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

export const prayerInputSchema = z.object({ namaaz: namaazSchema, missed: missed.optional() });

export const prayerUpdateSchema = z
  .object({ namaaz: namaazSchema.optional(), missed: missed.optional() })
  .refine(hasAnyField, { error: 'Provide namaaz or missed to update' });

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

export type PrayerInput = z.infer<typeof prayerInputSchema>;
export type PrayerUpdate = z.infer<typeof prayerUpdateSchema>;
export type HealthTrackingInput = z.infer<typeof healthInputSchema>;
export type HealthTrackingUpdate = z.infer<typeof healthUpdateSchema>;
