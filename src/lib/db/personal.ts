import { asc, desc, eq } from 'drizzle-orm';
import { idEq } from './ids';
import type { HealthTrackingInput, HealthTrackingUpdate, PrayerInput, PrayerUpdate } from '@/types/personal';
import { getDb } from './index';
import { healthTracking, prayers } from './schema';

/**
 * Drizzle writes an explicit `undefined` as a column value, so partial updates
 * have to drop absent keys rather than pass them through.
 */
function defined<T extends object>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

export async function listPrayers() {
  return getDb().select().from(prayers).orderBy(asc(prayers.namaaz));
}

export async function getPrayer(id: string) {
  const [row] = await getDb().select().from(prayers).where(idEq(prayers.id, id)).limit(1);
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
    .set({ ...defined(input), updatedAt: new Date() })
    .where(idEq(prayers.id, id))
    .returning();
  return row ?? null;
}

export async function deletePrayer(id: string) {
  const deleted = await getDb().delete(prayers).where(idEq(prayers.id, id)).returning({ id: prayers.id });
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
  const [row] = await getDb().select().from(healthTracking).where(idEq(healthTracking.id, id)).limit(1);
  return row ?? null;
}

export async function createHealthTracking(input: HealthTrackingInput) {
  const [row] = await getDb().insert(healthTracking).values(defined(input)).returning();
  return row;
}

export async function updateHealthTracking(id: string, input: HealthTrackingUpdate) {
  const [row] = await getDb().update(healthTracking).set(defined(input)).where(idEq(healthTracking.id, id)).returning();
  return row ?? null;
}

export async function deleteHealthTracking(id: string) {
  const deleted = await getDb()
    .delete(healthTracking)
    .where(idEq(healthTracking.id, id))
    .returning({ id: healthTracking.id });
  return deleted.length > 0;
}

export function isUniqueViolation(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    return true;
  }
  return String(error).includes('prayers_namaaz_uidx') || String(error).includes('duplicate key');
}
