import { asc, desc, eq } from 'drizzle-orm';
import type {
  HealthTrackingInput,
  HealthTrackingUpdate,
  PrayerInput,
  PrayerUpdate,
} from '@/types/personal';
import { getDb } from './index';
import { healthTracking, prayers } from './schema';

export async function listPrayers() {
  return getDb().select().from(prayers).orderBy(asc(prayers.namaaz));
}

export async function getPrayer(id: string) {
  const [row] = await getDb().select().from(prayers).where(eq(prayers.id, id)).limit(1);
  return row ?? null;
}

export async function getPrayerByNamaaz(namaaz: PrayerInput['namaaz']) {
  const [row] = await getDb().select().from(prayers).where(eq(prayers.namaaz, namaaz)).limit(1);
  return row ?? null;
}

export async function createPrayer(input: PrayerInput) {
  const [row] = await getDb()
    .insert(prayers)
    .values({
      namaaz: input.namaaz,
      missed: input.missed ?? 0,
    })
    .returning();
  return row;
}

export async function updatePrayer(id: string, input: PrayerUpdate) {
  const [row] = await getDb()
    .update(prayers)
    .set({
      ...(input.namaaz !== undefined ? { namaaz: input.namaaz } : {}),
      ...(input.missed !== undefined ? { missed: input.missed } : {}),
      updatedAt: new Date(),
    })
    .where(eq(prayers.id, id))
    .returning();
  return row ?? null;
}

export async function deletePrayer(id: string) {
  const deleted = await getDb().delete(prayers).where(eq(prayers.id, id)).returning({ id: prayers.id });
  return deleted.length > 0;
}

export async function listHealthTracking(metric?: string) {
  return getDb()
    .select()
    .from(healthTracking)
    .where(metric ? eq(healthTracking.metric, metric) : undefined)
    .orderBy(desc(healthTracking.createdAt));
}

export async function getHealthTracking(id: string) {
  const [row] = await getDb().select().from(healthTracking).where(eq(healthTracking.id, id)).limit(1);
  return row ?? null;
}

export async function createHealthTracking(input: HealthTrackingInput) {
  const [row] = await getDb()
    .insert(healthTracking)
    .values({
      metric: input.metric,
      value: input.value,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    })
    .returning();
  return row;
}

export async function updateHealthTracking(id: string, input: HealthTrackingUpdate) {
  const [row] = await getDb()
    .update(healthTracking)
    .set({
      ...(input.metric !== undefined ? { metric: input.metric } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
    })
    .where(eq(healthTracking.id, id))
    .returning();
  return row ?? null;
}

export async function deleteHealthTracking(id: string) {
  const deleted = await getDb()
    .delete(healthTracking)
    .where(eq(healthTracking.id, id))
    .returning({ id: healthTracking.id });
  return deleted.length > 0;
}

export function isUniqueViolation(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    return true;
  }
  return String(error).includes('prayers_namaaz_uidx') || String(error).includes('duplicate key');
}
