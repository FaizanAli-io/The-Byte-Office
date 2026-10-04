import type { prayers } from '@/lib/db/schema';

export type Prayer = typeof prayers.$inferSelect;
export type HealthTracking = { id: string; metricId: string; metric: string; value: number; createdAt: Date };
export type HealthMetric = { id: string; name: string; readingCount: number };

export type { HealthTrackingInput, HealthTrackingUpdate, PrayerInput, PrayerUpdate } from '@/lib/personal-validation';
