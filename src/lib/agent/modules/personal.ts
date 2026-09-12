import {
  createHealthTracking,
  deleteHealthTracking,
  deletePrayer,
  getHealthTracking,
  getPrayer,
  getPrayerByNamaaz,
  listHealthTracking,
  listPrayers,
  updateHealthTracking,
  updatePrayer,
  createPrayer,
} from '@/lib/db/personal';
import { NAMAAZ_VALUES } from '@/lib/db/schema';
import { AgentActionError, toPublicAction } from '@/lib/agent/action-utils';
import { createAgentAction, fingerprint } from '@/lib/finance-agent/repository';
import type { GroqTool } from '@/lib/finance-agent/tools';
import type { AgentActionPayload, PendingAgentAction } from '@/lib/finance-agent/types';
import { isNamaaz, parseTimestamp, validInteger } from '@/lib/personal-validation';
import { isRecord, validName } from '@/lib/finance-validation';

export const personalTools: GroqTool[] = [
  {
    type: 'function',
    function: {
      name: 'prayers_list',
      description: 'List missed-prayer counts for fajr, zuhr, asar, maghreb, and isha.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prayer_set',
      description:
        'Create a confirmation proposal to set the missed count for one namaaz. Never claim the change was saved.',
      parameters: {
        type: 'object',
        properties: {
          namaaz: { type: 'string', enum: [...NAMAAZ_VALUES] },
          missed: { type: 'integer', minimum: 0 },
        },
        required: ['namaaz', 'missed'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prayer_remove',
      description: 'Create a confirmation proposal to delete one prayer row by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'health_list',
      description: 'List health tracking entries, newest first. Optionally filter by metric name.',
      parameters: {
        type: 'object',
        properties: { metric: { type: 'string' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'health_add',
      description: 'Create a confirmation proposal to add a health metric reading. createdAt is optional.',
      parameters: {
        type: 'object',
        properties: {
          metric: { type: 'string' },
          value: { type: 'integer' },
          createdAt: { type: 'string' },
        },
        required: ['metric', 'value'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'health_update',
      description: 'Create a confirmation proposal to update one health tracking entry by id.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          metric: { type: 'string' },
          value: { type: 'integer' },
          createdAt: { type: 'string' },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'health_remove',
      description: 'Create a confirmation proposal to delete one health tracking entry by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
];

export const personalToolNames = new Set(personalTools.map((tool) => tool.function.name));

export async function executePersonalTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ output: unknown; pendingAction?: PendingAgentAction }> {
  if (name === 'prayers_list') {
    return { output: await listPrayers() };
  }
  if (name === 'health_list') {
    const metric = typeof args.metric === 'string' && args.metric.trim() ? args.metric.trim() : undefined;
    return { output: await listHealthTracking(metric) };
  }
  if (name === 'prayer_set' || name === 'prayer_remove' || name === 'health_add' || name === 'health_update' || name === 'health_remove') {
    const pendingAction = await proposePersonalAction(name, args);
    return {
      output: {
        status: 'pending_confirmation',
        action: pendingAction,
        instruction: 'Tell the user to review the confirmation card. Do not claim the change was applied.',
      },
      pendingAction,
    };
  }
  throw new Error(`Unknown personal tool: ${name}`);
}

async function proposePersonalAction(
  actionType: 'prayer_set' | 'prayer_remove' | 'health_add' | 'health_update' | 'health_remove',
  args: Record<string, unknown>
) {
  if (actionType === 'prayer_set') {
    if (!isNamaaz(args.namaaz)) throw new AgentActionError('Invalid namaaz');
    if (!validInteger(args.missed) || args.missed < 0) throw new AgentActionError('Missed must be a non-negative integer');
    const current = await getPrayerByNamaaz(args.namaaz);
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, namaaz: args.namaaz, missed: args.missed },
        preview: {
          title: `Set ${args.namaaz} missed count`,
          before: current,
          after: { namaaz: args.namaaz, missed: args.missed },
        },
        sourceFingerprint: current ? fingerprint(current) : null,
      })
    );
  }

  if (actionType === 'prayer_remove') {
    const id = requireId(args.id);
    const current = await getPrayer(id);
    if (!current) throw new AgentActionError('Prayer not found', 404);
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, id },
        preview: { title: `Remove ${current.namaaz} prayer row`, before: current },
        sourceFingerprint: fingerprint(current),
      })
    );
  }

  if (actionType === 'health_add') {
    const entry = parseHealthInput(args);
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

  const changes = parseHealthUpdate(args);
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
  payload: Extract<
    AgentActionPayload,
    { actionType: 'prayer_set' | 'prayer_remove' | 'health_add' | 'health_update' | 'health_remove' }
  >,
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

  if (payload.actionType === 'prayer_remove') {
    const current = await getPrayer(payload.id);
    if (!current) throw new AgentActionError('Prayer no longer exists', 409);
    if (sourceFingerprint && fingerprint(current) !== sourceFingerprint) {
      throw new AgentActionError('That prayer row changed. Ask the assistant to try again.', 409);
    }
    await deletePrayer(payload.id);
    return { id: payload.id, removed: true };
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

function parseHealthInput(args: Record<string, unknown>) {
  if (!validName(args.metric)) throw new AgentActionError('Metric is required');
  if (!validInteger(args.value)) throw new AgentActionError('Value must be an integer');
  const createdAt = args.createdAt === undefined ? undefined : parseTimestamp(args.createdAt);
  if (args.createdAt !== undefined && !createdAt) throw new AgentActionError('createdAt must be a valid date');
  return {
    metric: args.metric.trim(),
    value: args.value,
    createdAt: createdAt?.toISOString(),
  };
}

function parseHealthUpdate(args: Record<string, unknown>) {
  const changes: { metric?: string; value?: number; createdAt?: string } = {};
  if (args.metric !== undefined) {
    if (!validName(args.metric)) throw new AgentActionError('Metric is required');
    changes.metric = args.metric.trim();
  }
  if (args.value !== undefined) {
    if (!validInteger(args.value)) throw new AgentActionError('Value must be an integer');
    changes.value = args.value;
  }
  if (args.createdAt !== undefined) {
    const createdAt = parseTimestamp(args.createdAt);
    if (!createdAt) throw new AgentActionError('createdAt must be a valid date');
    changes.createdAt = createdAt.toISOString();
  }
  if (!isRecord(changes) || Object.keys(changes).length === 0) {
    throw new AgentActionError('Provide metric, value, or createdAt to update');
  }
  return changes;
}

function requireId(value: unknown) {
  if (typeof value !== 'string' || !value) throw new AgentActionError('id is required');
  return value;
}
