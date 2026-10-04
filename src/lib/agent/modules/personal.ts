import {
  createHealthTracking,
  deleteHealthTracking,
  getHealthTracking,
  getPrayerByNamaaz,
  listHealthTracking,
  loadPrayerTracker,
  updateHealthTracking,
  updatePrayer,
  createPrayer,
} from '@/lib/db/personal';
import { AgentActionError, pendingResult, toPublicAction } from '@/lib/agent/action-utils';
import { createAgentAction, fingerprint } from '@/lib/agent/repository';
import { toolNamesForModule } from '@/lib/agent/registry';
import type { AgentActionPayload, PendingAgentAction } from '@/lib/agent/types';
import { healthInputSchema, healthUpdateSchema, prayerSetSchema } from '@/lib/personal-validation';
import { parseWith } from '@/lib/api';

export const personalToolNames = toolNamesForModule('personal');

export async function executePersonalTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ output: unknown; pendingAction?: PendingAgentAction }> {
  if (name === 'prayers_list') {
    return { output: await loadPrayerTracker() };
  }
  if (name === 'health_list') {
    const metric = typeof args.metric === 'string' && args.metric.trim() ? args.metric.trim() : undefined;
    return { output: await listHealthTracking(metric) };
  }
  if (name === 'prayer_set' || name === 'health_add' || name === 'health_update' || name === 'health_remove') {
    return pendingResult(await proposePersonalAction(name, args));
  }
  throw new Error(`Unknown personal tool: ${name}`);
}

async function proposePersonalAction(
  actionType: 'prayer_set' | 'health_add' | 'health_update' | 'health_remove',
  args: Record<string, unknown>
) {
  if (actionType === 'prayer_set') {
    const { namaaz, missed } = parseWith(prayerSetSchema, args);
    const current = await getPrayerByNamaaz(namaaz);
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, namaaz, missed },
        preview: {
          title: `Set ${namaaz} missed count`,
          before: current,
          after: { namaaz, missed },
        },
        sourceFingerprint: current ? fingerprint(current) : null,
      })
    );
  }

  if (actionType === 'health_add') {
    const entry = toStoredHealth(parseWith(healthInputSchema, args));
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, ...entry },
        preview: { title: `Add ${entry.metric} reading`, after: entry },
      })
    );
  }

  const id = requireId(args.id);
  const current = await getHealthTracking(id);
  if (!current) throw new AgentActionError('Health tracking entry not found', 404);

  if (actionType === 'health_remove') {
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, id },
        preview: { title: `Remove ${current.metric} reading`, before: current },
        sourceFingerprint: fingerprint(current),
      })
    );
  }

  const changes = toStoredHealth(parseWith(healthUpdateSchema, args));
  return toPublicAction(
    await createAgentAction({
      actionType,
      payload: { actionType, id, ...changes },
      preview: {
        title: `Update ${current.metric} reading`,
        before: current,
        after: { ...current, ...changes },
      },
      sourceFingerprint: fingerprint(current),
    })
  );
}

export async function executePersonalPayload(
  payload: Extract<AgentActionPayload, { actionType: 'prayer_set' | 'health_add' | 'health_update' | 'health_remove' }>,
  sourceFingerprint: string | null
) {
  if (payload.actionType === 'prayer_set') {
    const current = await getPrayerByNamaaz(payload.namaaz);
    if (current && sourceFingerprint && fingerprint(current) !== sourceFingerprint) {
      throw new AgentActionError('That prayer row changed. Ask the assistant to try again.', 409);
    }
    if (current) return updatePrayer(current.id, { missed: payload.missed });
    return createPrayer({ namaaz: payload.namaaz, missed: payload.missed });
  }

  if (payload.actionType === 'health_add') {
    return createHealthTracking({
      metric: payload.metric,
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
    metric: payload.metric,
    value: payload.value,
    createdAt: payload.createdAt ? new Date(payload.createdAt) : undefined,
  });
}

/**
 * Payloads are stored as JSONB, so dates travel as ISO strings. Undefined keys
 * are dropped rather than passed through: the update preview spreads these over
 * the current row, and an explicit `createdAt: undefined` would blank it.
 */
function toStoredHealth<T extends { createdAt?: Date }>(value: T) {
  const stored: Record<string, unknown> = { ...value, createdAt: value.createdAt?.toISOString() };
  for (const key of Object.keys(stored)) {
    if (stored[key] === undefined) delete stored[key];
  }
  return stored as Omit<T, 'createdAt'> & { createdAt?: string };
}

function requireId(value: unknown) {
  if (typeof value !== 'string' || !value) throw new AgentActionError('id is required');
  return value;
}
