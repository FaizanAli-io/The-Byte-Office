import type { healthTracking, prayers } from '@/lib/db/schema';

export type Prayer = typeof prayers.$inferSelect;
export type HealthTracking = typeof healthTracking.$inferSelect;

export type { HealthTrackingInput, HealthTrackingUpdate, PrayerInput, PrayerUpdate } from '@/lib/personal-validation';
