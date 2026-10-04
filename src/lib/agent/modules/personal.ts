import {
  addHealthMetric,
  assertMetricNameIsFree,
  createHealthTracking,
  createPrayer,
  deleteHealthTracking,
  getHealthTracking,
  getPrayerByNamaaz,
  listHealthMetrics,
  listHealthTracking,
  loadPrayerTracker,
  removeHealthMetric,
  renameHealthMetric,
  requireHealthMetricId,
  updateHealthTracking,
  updatePrayer,
} from '@/lib/db/personal';
import { AgentActionError, pendingResult } from '@/lib/agent/action-utils';
import { fingerprint, saveProposal } from '@/lib/agent/repository';
import { agentToolRegistry, toolNamesForModule } from '@/lib/agent/registry';
import type { AgentActionPayload, AgentProposal, PendingAgentAction, PersonalActionType } from '@/lib/agent/types';
import type { Namaaz } from '@/lib/db/schema';
import { healthByNameSchema, healthUpdateByNameSchema } from '@/lib/personal-validation';
import { parseWith } from '@/lib/api';

export const personalToolNames = toolNamesForModule('personal');

const personalWrites = new Set(
  agentToolRegistry.filter((tool) => tool.module === 'personal' && tool.write).map((tool) => tool.name)
);

export async function executePersonalTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ output: unknown; pendingAction?: PendingAgentAction }> {
  if (name === 'prayers_list') return { output: await loadPrayerTracker() };
  if (name === 'health_metrics_list') return { output: await listHealthMetrics() };
  if (name === 'health_list') {
    const metric = typeof args.metric === 'string' && args.metric.trim() ? args.metric : undefined;
    return { output: await listHealthTracking(metric ? await requireHealthMetricId(metric) : undefined) };
  }
  if (personalWrites.has(name)) {
    return pendingResult(await saveProposal(await proposePersonalAction(name as PersonalActionType, args)));
  }
  throw new Error(`Unknown personal tool: ${name}`);
}

export async function proposePersonalAction(
  actionType: PersonalActionType,
  args: Record<string, unknown>
): Promise<AgentProposal> {
  if (actionType === 'prayer_set') {
    const { namaaz, missed } = args as { namaaz: Namaaz; missed: number };
    const current = await getPrayerByNamaaz(namaaz);
    return {
      actionType,
      payload: { actionType, namaaz, missed },
      preview: { title: `Set ${namaaz} missed count`, before: current, after: { namaaz, missed } },
      sourceFingerprint: current ? fingerprint(current) : null,
    };
  }

  if (actionType === 'health_metric_add') {
    const name = args.name as string;
    await assertMetricNameIsFree(name);
    return { actionType, payload: { actionType, name }, preview: { title: `Add health metric "${name}"` } };
  }

  if (actionType === 'health_metric_update' || actionType === 'health_metric_remove') {
    const current = (await listHealthMetrics()).find((metric) => metric.id === args.id);
    if (!current) throw new AgentActionError('Health metric not found. Call health_metrics_list for the ids.', 404);
    if (actionType === 'health_metric_remove') {
      if (current.readingCount) {
        throw new AgentActionError(`${current.readingCount} readings use "${current.name}" — rename it instead`, 409);
      }
      return {
        actionType,
        payload: { actionType, id: current.id },
        preview: { title: `Delete health metric "${current.name}"`, before: current },
      };
    }
    const name = args.name as string;
    await assertMetricNameIsFree(name, current.id);
    return {
      actionType,
      payload: { actionType, id: current.id, name },
      preview: { title: `Rename health metric "${current.name}"`, before: current, after: { name } },
    };
  }

  if (actionType === 'health_add') {
    const { metric, ...reading } = parseWith(healthByNameSchema, args);
    const entry = toStoredHealth({ ...reading, metricId: await requireHealthMetricId(metric) });
    return {
      actionType,
      payload: { actionType, ...entry },
      preview: { title: `Add ${metric} reading`, after: { metric, ...entry } },
    };
  }

  const id = typeof args.id === 'string' && args.id ? args.id : '';
  const current = await getHealthTracking(id);
  if (!current) throw new AgentActionError('Health tracking entry not found', 404);

  if (actionType === 'health_remove') {
    return {
      actionType,
      payload: { actionType, id },
      preview: { title: `Remove ${current.metric} reading`, before: current },
      sourceFingerprint: fingerprint(current),
    };
  }

  const { metric, ...reading } = parseWith(healthUpdateByNameSchema, args);
  const changes = toStoredHealth({ ...reading, metricId: metric ? await requireHealthMetricId(metric) : undefined });
  return {
    actionType,
    payload: { actionType, id, ...changes },
    preview: {
      title: `Update ${current.metric} reading`,
      before: current,
      after: { ...current, ...changes, ...(metric ? { metric } : {}) },
    },
    sourceFingerprint: fingerprint(current),
  };
}

export async function executePersonalPayload(
  payload: Extract<AgentActionPayload, { actionType: PersonalActionType }>,
  sourceFingerprint: string | null
) {
  switch (payload.actionType) {
    case 'prayer_set': {
      const current = await getPrayerByNamaaz(payload.namaaz);
      if (current && sourceFingerprint && fingerprint(current) !== sourceFingerprint) {
        throw new AgentActionError('That prayer row changed. Ask the assistant to try again.', 409);
      }
      if (current) return updatePrayer(current.id, { missed: payload.missed });
      return createPrayer({ namaaz: payload.namaaz, missed: payload.missed });
    }
    case 'health_metric_add':
      return addHealthMetric(payload.name);
    case 'health_metric_update':
      return renameHealthMetric(payload.id, payload.name);
    case 'health_metric_remove':
      await removeHealthMetric(payload.id);
      return { id: payload.id, removed: true };
    case 'health_add':
      return createHealthTracking({
        metricId: payload.metricId,
        value: payload.value,
        createdAt: payload.createdAt ? new Date(payload.createdAt) : undefined,
      });
  }

  const current = await getHealthTracking(payload.id);
  if (!current) throw new AgentActionError('Health tracking entry no longer exists', 409);
  if (sourceFingerprint && fingerprint(current) !== sourceFingerprint) {
    throw new AgentActionError('That health entry changed. Ask the assistant to try again.', 409);
  }
  if (payload.actionType === 'health_remove') {
    await deleteHealthTracking(payload.id);
    return { id: payload.id, removed: true };
  }
  return updateHealthTracking(payload.id, {
    metricId: payload.metricId,
    value: payload.value,
    createdAt: payload.createdAt ? new Date(payload.createdAt) : undefined,
  });
}

function toStoredHealth<T extends { createdAt?: Date }>(value: T) {
  const stored: Record<string, unknown> = { ...value, createdAt: value.createdAt?.toISOString() };
  for (const key of Object.keys(stored)) {
    if (stored[key] === undefined) delete stored[key];
  }
  return stored as Omit<T, 'createdAt'> & { createdAt?: string };
}
