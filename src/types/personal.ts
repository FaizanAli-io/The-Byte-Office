import type { prayers } from '@/lib/db/schema';

export const NAMAAZ_VALUES = ['fajr', 'zuhr', 'asar', 'maghreb', 'isha'] as const;
export type Namaaz = (typeof NAMAAZ_VALUES)[number];

export type Prayer = typeof prayers.$inferSelect;
export type HealthTracking = { id: string; metricId: string; metric: string; value: number; createdAt: Date };
export type HealthMetric = { id: string; name: string; readingCount: number };
