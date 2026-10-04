import type { Namaaz } from '@/types/personal';
import type { Holding } from '@/types/finance';
import type { CategoryKind, LedgerAccount, LedgerCategory, LedgerEntry } from '@/types/ledger';

export type HoldingInput = Omit<Holding, 'id'>;

export type LedgerAccountChanges = {
  name?: string;
  openingBalance?: number;
  exchangeRate?: number;
  actualClosingBalance?: number | null;
  openingCostBasis?: number | null;
};

export type PersonalActionType =
  | 'prayer_set'
  | 'health_add'
  | 'health_update'
  | 'health_remove'
  | 'health_metric_add'
  | 'health_metric_update'
  | 'health_metric_remove';

export type AgentActionPayload =
  | { actionType: 'portfolio_item_add'; item: HoldingInput }
  | { actionType: 'portfolio_item_update'; id: string; changes: Omit<HoldingInput, 'kind'> }
  | { actionType: 'portfolio_item_remove'; id: string }
  | {
      actionType: 'ledger_entry_add';
      month: string;
      entry: Partial<LedgerEntry> & { id: string; date: string };
    }
  | {
      actionType: 'ledger_entry_update';
      month: string;
      entryId: string;
      entry: Partial<LedgerEntry> & { id: string };
    }
  | {
      actionType: 'ledger_entry_remove';
      month: string;
      entryId: string;
    }
  | {
      actionType: 'ledger_account_add';
      month: string;
      account: LedgerAccount;
    }
  | {
      actionType: 'ledger_account_update';
      month: string;
      accountId: string;
      changes: LedgerAccountChanges;
    }
  | {
      actionType: 'ledger_account_remove';
      month: string;
      accountId: string;
    }
  | {
      actionType: 'category_add';
      name: string;
      kind: CategoryKind;
    }
  | {
      actionType: 'category_update';
      id: string;
      changes: { name?: string; kind?: CategoryKind; archived?: boolean };
    }
  | {
      actionType: 'category_remove';
      id: string;
      name: string;
    }
  | {
      actionType: 'prayer_set';
      namaaz: Namaaz;
      missed: number;
    }
  | {
      actionType: 'health_add';
      metricId: string;
      value: number;
      createdAt?: string;
    }
  | {
      actionType: 'health_update';
      id: string;
      metricId?: string;
      value?: number;
      createdAt?: string;
    }
  | {
      actionType: 'health_remove';
      id: string;
    }
  | { actionType: 'health_metric_add'; name: string }
  | { actionType: 'health_metric_update'; id: string; name: string }
  | { actionType: 'health_metric_remove'; id: string }
  | {
      actionType: 'tbo_send_inquiry';
      name: string;
      email: string;
      company?: string;
      service?: string;
      message: string;
    };

export type AgentActionType = AgentActionPayload['actionType'];

export type ActionPreview = {
  title: string;
  before?: unknown;
  after?: unknown;
};

export type LedgerEntryFormState = {
  kind: 'ledger_entry_add' | 'ledger_entry_update';
  month: string;
  accounts: Pick<LedgerAccount, 'id' | 'name' | 'currency' | 'type' | 'exchangeRate'>[];
  categories: LedgerCategory[];
  entry: Partial<LedgerEntry> & { date: string };
};

export type AgentProposal = {
  actionType: AgentActionType;
  payload: AgentActionPayload;
  preview: ActionPreview;
  sourceFingerprint?: string | null;
  form?: LedgerEntryFormState;
};

export type PendingAgentAction = {
  id: string;
  actionType: AgentActionType;
  preview: ActionPreview;
  status: 'pending' | 'executing' | 'completed' | 'cancelled' | 'failed';
  expiresAt: string;
  error?: string | null;
  form?: LedgerEntryFormState;
};

export type AgentChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  actions?: PendingAgentAction[];
  isError?: boolean;
};

export type AgentResponse = {
  message: AgentChatMessage;
  model: string;
};

export type AgentStreamEvent =
  | { type: 'status'; status: 'thinking' | 'reading' }
  | { type: 'delta'; content: string }
  | { type: 'done'; response: AgentResponse }
  | { type: 'error'; error: string };

export type AgentWorkspace = 'finance' | 'personal';

export type AgentConversation = {
  id: string;
  title: string;
  workspace: AgentWorkspace;
  createdAt: string;
  updatedAt: string;
};

export function parseAgentWorkspace(value: unknown): AgentWorkspace {
  return value === 'personal' ? 'personal' : 'finance';
}
