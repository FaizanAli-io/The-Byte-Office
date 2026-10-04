import { createHash } from 'crypto';
import { ApiError } from '@/lib/api';
import type { ActionPreview, AgentActionType, LedgerEntryFormState, PendingAgentAction } from '@/lib/agent/types';

export function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function assertUnchanged(current: string, expected: string | null, label: string) {
  if (current !== expected) {
    throw new ApiError(`The ${label} changed after this proposal. Ask the assistant to try again.`, 409);
  }
}

export function toPublicAction(
  action: {
    id: string;
    actionType: string;
    preview: ActionPreview;
    status: PendingAgentAction['status'];
    expiresAt: Date;
    error: string | null;
  },
  form?: LedgerEntryFormState
): PendingAgentAction {
  return {
    id: action.id,
    actionType: action.actionType as AgentActionType,
    preview: action.preview,
    status: action.status,
    expiresAt: action.expiresAt.toISOString(),
    error: action.error,
    form,
  };
}

export function pendingResult(
  pendingAction: PendingAgentAction,
  instruction = 'Tell the user to review the confirmation card. Do not claim the change was applied.'
) {
  return { output: { status: 'pending_confirmation', action: pendingAction, instruction }, pendingAction };
}
