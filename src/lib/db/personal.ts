import { asc, desc, eq, sql } from 'drizzle-orm';
import { AgentActionError } from '@/lib/agent/action-utils';
import { idEq } from './ids';
import type { HealthTrackingInput, HealthTrackingUpdate, PrayerInput, PrayerUpdate } from '@/types/personal';
import { getDb } from './index';
import { NAMAAZ_VALUES, healthMetrics, healthTracking, prayerHistory, prayers, type Namaaz } from './schema';

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
    throw new AgentActionError(
      `No health metric is called "${name}". ${known.length ? `Use one of: ${known.join(', ')}` : 'Add it first'}.`,
      404
    );
  }
  return metric.id;
}

export async function assertMetricNameIsFree(name: string, exceptId?: string) {
  const clash = await findMetric(name);
  if (clash && clash.id !== exceptId)
    throw new AgentActionError(`There is already a metric called "${clash.name}"`, 409);
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
  if (!row) throw new AgentActionError('Health metric not found', 404);
  return row;
}

export async function removeHealthMetric(id: string) {
  const metric = (await listHealthMetrics()).find((row) => row.id === id);
  if (!metric) throw new AgentActionError('Health metric not found', 404);
  if (metric.readingCount) {
    throw new AgentActionError(`${metric.readingCount} readings use "${metric.name}" — rename it instead`, 409);
  }
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
    throw new AgentActionError('Health metric not found', 404);
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
    .set(defined(input))
    .where(idEq(healthTracking.id, id))
    .returning({ id: healthTracking.id });
  return row ? getHealthTracking(row.id) : null;
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
