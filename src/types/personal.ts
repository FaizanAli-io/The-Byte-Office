import type { Namaaz } from '@/lib/db/schema';

export type { Namaaz };

export type Prayer = {
  id: string;
  namaaz: Namaaz;
  missed: number;
  updatedAt: Date;
};

export type PrayerInput = {
  namaaz: Namaaz;
  missed?: number;
};

export type PrayerUpdate = {
  namaaz?: Namaaz;
  missed?: number;
};

export type HealthTracking = {
  id: string;
  metric: string;
  value: number;
  createdAt: Date;
};

export type HealthTrackingInput = {
  metric: string;
  value: number;
  createdAt?: Date;
};

export type HealthTrackingUpdate = {
  metric?: string;
  value?: number;
  createdAt?: Date;
};
