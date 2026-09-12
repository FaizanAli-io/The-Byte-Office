import type { AgentActionType, LedgerEntryFormState, PendingAgentAction } from '@/lib/finance-agent/types';

export class AgentActionError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export function toPublicAction(
  action: {
    id: string;
    actionType: string;
    preview: { title: string; before?: unknown; after?: unknown };
    status: 'pending' | 'executing' | 'completed' | 'cancelled' | 'failed';
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
