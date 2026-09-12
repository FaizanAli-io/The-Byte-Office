import { NAMAAZ_VALUES, type Namaaz } from '@/lib/db/schema';
import { isRecord, validName } from '@/lib/finance-validation';
import type { HealthTrackingInput, HealthTrackingUpdate, PrayerInput, PrayerUpdate } from '@/types/personal';

export function isNamaaz(value: unknown): value is Namaaz {
  return typeof value === 'string' && (NAMAAZ_VALUES as readonly string[]).includes(value);
}

export function validInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function parseTimestamp(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validatePrayerInput(value: unknown): { data: PrayerInput; error?: undefined } | { error: string } {
  if (!isRecord(value)) return { error: 'Invalid prayer' };
  if (!isNamaaz(value.namaaz)) {
    return { error: `Namaaz must be one of: ${NAMAAZ_VALUES.join(', ')}` };
  }
  if (value.missed !== undefined && !(validInteger(value.missed) && value.missed >= 0)) {
    return { error: 'Missed must be a non-negative integer' };
  }
  return { data: { namaaz: value.namaaz, missed: value.missed } };
}

export function validatePrayerUpdate(value: unknown): { data: PrayerUpdate; error?: undefined } | { error: string } {
  if (!isRecord(value)) return { error: 'Invalid prayer update' };
  const data: PrayerUpdate = {};
  if (value.namaaz !== undefined) {
    if (!isNamaaz(value.namaaz)) {
      return { error: `Namaaz must be one of: ${NAMAAZ_VALUES.join(', ')}` };
    }
    data.namaaz = value.namaaz;
  }
  if (value.missed !== undefined) {
    if (!(validInteger(value.missed) && value.missed >= 0)) {
      return { error: 'Missed must be a non-negative integer' };
    }
    data.missed = value.missed;
  }
  if (data.namaaz === undefined && data.missed === undefined) {
    return { error: 'Provide namaaz or missed to update' };
  }
  return { data };
}

export function validateHealthTrackingInput(
  value: unknown
): { data: HealthTrackingInput; error?: undefined } | { error: string } {
  if (!isRecord(value)) return { error: 'Invalid health tracking entry' };
  if (!validName(value.metric)) return { error: 'Metric is required' };
  if (!validInteger(value.value)) return { error: 'Value must be an integer' };

  const data: HealthTrackingInput = {
    metric: value.metric.trim(),
    value: value.value,
  };

  if (value.createdAt !== undefined) {
    const createdAt = parseTimestamp(value.createdAt);
    if (!createdAt) return { error: 'createdAt must be a valid date' };
    data.createdAt = createdAt;
  }

  return { data };
}

export function validateHealthTrackingUpdate(
  value: unknown
): { data: HealthTrackingUpdate; error?: undefined } | { error: string } {
  if (!isRecord(value)) return { error: 'Invalid health tracking update' };
  const data: HealthTrackingUpdate = {};

  if (value.metric !== undefined) {
    if (!validName(value.metric)) return { error: 'Metric is required' };
    data.metric = value.metric.trim();
  }
  if (value.value !== undefined) {
    if (!validInteger(value.value)) return { error: 'Value must be an integer' };
    data.value = value.value;
  }
  if (value.createdAt !== undefined) {
    const createdAt = parseTimestamp(value.createdAt);
    if (!createdAt) return { error: 'createdAt must be a valid date' };
    data.createdAt = createdAt;
  }
  if (data.metric === undefined && data.value === undefined && data.createdAt === undefined) {
    return { error: 'Provide metric, value, or createdAt to update' };
  }
  return { data };
}
