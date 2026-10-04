import { asc, desc, eq } from 'drizzle-orm';
import { idEq } from './ids';
import type { HealthTrackingInput, HealthTrackingUpdate, PrayerInput, PrayerUpdate } from '@/types/personal';
import { getDb } from './index';
import { NAMAAZ_VALUES, healthTracking, prayerHistory, prayers, type Namaaz } from './schema';

function defined<T extends object>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

export async function listPrayers() {
  return getDb().select().from(prayers).orderBy(asc(prayers.namaaz));
}

export async function loadPrayerTracker() {
  const [rows, [latest]] = await Promise.all([
    listPrayers(),
    getDb().select().from(prayerHistory).orderBy(desc(prayerHistory.recordedAt)).limit(1),
  ]);
  return { prayers: rows, updatedAt: latest?.recordedAt ?? null };
}

async function recordPrayerHistory() {
  const db = getDb();
  const [rows, [latest]] = await Promise.all([
    db.select().from(prayers),
    db.select().from(prayerHistory).orderBy(desc(prayerHistory.recordedAt)).limit(1),
  ]);
  const counts = Object.fromEntries(
    NAMAAZ_VALUES.map((namaaz) => [namaaz, rows.find((row) => row.namaaz === namaaz)?.missed ?? 0])
  ) as Record<Namaaz, number>;
  if (latest && NAMAAZ_VALUES.every((namaaz) => latest.counts[namaaz] === counts[namaaz])) return;
  await db.insert(prayerHistory).values({ counts });
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
  await recordPrayerHistory();
  return row;
}

export async function updatePrayer(id: string, input: PrayerUpdate) {
  const [row] = await getDb().update(prayers).set(defined(input)).where(idEq(prayers.id, id)).returning();
  if (row) await recordPrayerHistory();
  return row ?? null;
}

export async function deletePrayer(id: string) {
  const deleted = await getDb().delete(prayers).where(idEq(prayers.id, id)).returning({ id: prayers.id });
  if (deleted.length) await recordPrayerHistory();
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
