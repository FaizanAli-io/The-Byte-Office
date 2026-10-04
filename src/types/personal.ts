import type { healthTracking, prayers } from '@/lib/db/schema';

// Row shapes come straight from the Drizzle schema so they cannot drift from
// the tables; the input shapes come from the zod schemas that validate them.
export type Prayer = typeof prayers.$inferSelect;
export type HealthTracking = typeof healthTracking.$inferSelect;

export type { HealthTrackingInput, HealthTrackingUpdate, PrayerInput, PrayerUpdate } from '@/lib/personal-validation';
