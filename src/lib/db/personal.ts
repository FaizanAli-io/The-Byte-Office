import { ApiError } from '@/lib/api';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { deleteById, idEq } from './ids';
import type { HealthTrackingInput, HealthTrackingUpdate, PrayerSet } from '@/lib/personal-validation';
import { getDb } from './index';
import { NAMAAZ_VALUES, type Namaaz } from '@/types/personal';
import { healthMetrics, healthTracking, prayerHistory, prayers } from './schema';

export async function loadPrayerTracker() {
  const [rows, [latest]] = await Promise.all([
    getDb().select().from(prayers).orderBy(asc(prayers.namaaz)),
    getDb().select().from(prayerHistory).orderBy(desc(prayerHistory.recordedAt)).limit(1),
  ]);
  return { prayers: rows, updatedAt: latest?.recordedAt ?? null };
}

async function recordPrayerHistory(test?: boolean) {
  if (test) return;
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

export async function getPrayerByNamaaz(namaaz: Namaaz) {
  const [row] = await getDb().select().from(prayers).where(eq(prayers.namaaz, namaaz)).limit(1);
  return row ?? null;
}

// One row per namaaz, so setting a count is an upsert on its unique index.
export async function setPrayer({ namaaz, missed, test }: PrayerSet) {
  const [row] = await getDb()
    .insert(prayers)
    .values({ namaaz, missed })
    .onConflictDoUpdate({ target: prayers.namaaz, set: { missed } })
    .returning();
  await recordPrayerHistory(test);
  return row;
}

const readingColumns = {
  id: healthTracking.id,
  metricId: healthTracking.metricId,
  metric: healthMetrics.name,
  value: healthTracking.value,
  createdAt: healthTracking.createdAt,
};

function readings() {
  return getDb()
    .select(readingColumns)
    .from(healthTracking)
    .innerJoin(healthMetrics, eq(healthMetrics.id, healthTracking.metricId));
}

export async function listHealthMetrics() {
  return getDb()
    .select({
      id: healthMetrics.id,
      name: healthMetrics.name,
      readingCount: sql<number>`count(${healthTracking.id})::int`,
    })
    .from(healthMetrics)
    .leftJoin(healthTracking, eq(healthTracking.metricId, healthMetrics.id))
    .groupBy(healthMetrics.id)
    .orderBy(asc(healthMetrics.name));
}

async function findMetric(name: string) {
  const [row] = await getDb()
    .select()
    .from(healthMetrics)
    .where(sql`lower(${healthMetrics.name}) = lower(${name.trim()})`)
    .limit(1);
  return row ?? null;
}

export async function requireHealthMetricId(name: string) {
  const metric = await findMetric(name);
  if (!metric) {
    const known = (await listHealthMetrics()).map((row) => row.name);
    throw new ApiError(
      `No health metric is called "${name}". ${known.length ? `Use one of: ${known.join(', ')}` : 'Add it first'}.`,
      404
    );
  }
  return metric.id;
}

export async function assertMetricNameIsFree(name: string, exceptId?: string) {
  const clash = await findMetric(name);
  if (clash && clash.id !== exceptId) throw new ApiError(`There is already a metric called "${clash.name}"`, 409);
}

export async function addHealthMetric(name: string) {
  await assertMetricNameIsFree(name);
  const [row] = await getDb().insert(healthMetrics).values({ name: name.trim() }).returning();
  return row;
}

export async function renameHealthMetric(id: string, name: string) {
  await assertMetricNameIsFree(name, id);
  const [row] = await getDb()
    .update(healthMetrics)
    .set({ name: name.trim() })
    .where(idEq(healthMetrics.id, id))
    .returning();
  if (!row) throw new ApiError('Health metric not found', 404);
  return row;
}

export function assertMetricUnused(metric: { name: string; readingCount: number }) {
  const { name, readingCount: count } = metric;
  if (count)
    throw new ApiError(`${count} ${count === 1 ? 'reading uses' : 'readings use'} "${name}" — rename it instead`, 409);
}

export async function removeHealthMetric(id: string) {
  const metric = (await listHealthMetrics()).find((row) => row.id === id);
  if (!metric) throw new ApiError('Health metric not found', 404);
  assertMetricUnused(metric);
  await getDb().delete(healthMetrics).where(idEq(healthMetrics.id, id));
  return metric;
}

export async function listHealthTracking(metricId?: string) {
  return readings()
    .where(metricId ? idEq(healthTracking.metricId, metricId) : undefined)
    .orderBy(desc(healthTracking.createdAt));
}

export async function getHealthTracking(id: string) {
  const [row] = await readings().where(idEq(healthTracking.id, id)).limit(1);
  return row ?? null;
}

async function assertMetricExists(id: string | undefined) {
  if (id !== undefined && !(await listHealthMetrics()).some((row) => row.id === id)) {
    throw new ApiError('Health metric not found', 404);
  }
}

export async function createHealthTracking(input: HealthTrackingInput) {
  await assertMetricExists(input.metricId);
  const [row] = await getDb().insert(healthTracking).values(input).returning({ id: healthTracking.id });
  return getHealthTracking(row.id);
}

export async function updateHealthTracking(id: string, input: HealthTrackingUpdate) {
  await assertMetricExists(input.metricId);
  const [row] = await getDb()
    .update(healthTracking)
    .set(input)
    .where(idEq(healthTracking.id, id))
    .returning({ id: healthTracking.id });
  return row ? getHealthTracking(row.id) : null;
}

export const deleteHealthTracking = (id: string) => deleteById(healthTracking, id);
