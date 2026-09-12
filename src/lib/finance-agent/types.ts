import type { LedgerAccount, LedgerEntry } from '@/types/ledger';

export type PortfolioItemType = 'local_bank' | 'remote_bank' | 'mutual_fund';

export type AgentActionType =
  | 'portfolio_item_add'
  | 'portfolio_item_update'
  | 'portfolio_item_remove'
  | 'ledger_entry_add'
  | 'ledger_entry_update'
  | 'ledger_entry_remove'
  | 'prayer_set'
  | 'prayer_remove'
  | 'health_add'
  | 'health_update'
  | 'health_remove'
  | 'tbo_send_inquiry';

export type PortfolioItemInput =
  | {
      itemType: 'local_bank';
      name: string;
      amountPkr: number;
    }
  | {
      itemType: 'remote_bank';
      name: string;
      amountUsd: number;
      exchangeRate: number;
    }
  | {
      itemType: 'mutual_fund';
      bankName: string;
      fundName: string;
      value: number;
    };

export type AgentActionPayload =
  | {
      actionType: 'portfolio_item_add';
      item: PortfolioItemInput;
    }
  | {
      actionType: 'portfolio_item_update';
      itemType: PortfolioItemType;
      id: string;
      changes: Record<string, unknown>;
    }
  | {
      actionType: 'portfolio_item_remove';
      itemType: PortfolioItemType;
      id: string;
    }
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
      actionType: 'prayer_set';
      namaaz: 'fajr' | 'zuhr' | 'asar' | 'maghreb' | 'isha';
      missed: number;
    }
  | {
      actionType: 'prayer_remove';
      id: string;
    }
  | {
      actionType: 'health_add';
      metric: string;
      value: number;
      createdAt?: string;
    }
  | {
      actionType: 'health_update';
      id: string;
      metric?: string;
      value?: number;
      createdAt?: string;
    }
  | {
      actionType: 'health_remove';
      id: string;
    }
  | {
      actionType: 'tbo_send_inquiry';
      name: string;
      email: string;
      company?: string;
      service?: string;
      message: string;
    };

export type ActionPreview = {
  title: string;
  before?: unknown;
  after?: unknown;
};

export type LedgerEntryFormState = {
  kind: 'ledger_entry_add' | 'ledger_entry_update';
  month: string;
  accounts: Pick<LedgerAccount, 'id' | 'name' | 'currency' | 'type' | 'exchangeRate'>[];
  entry: {
    id?: string;
    date: string;
    type?: LedgerEntry['type'];
    accountId?: string;
    destinationAccountId?: string;
    amount?: number;
    destinationAmount?: number;
    category?: string;
    note?: string;
  };
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

export type FinanceChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  actions?: PendingAgentAction[];
  isError?: boolean;
};

export type FinanceAgentResponse = {
  message: FinanceChatMessage;
  model: string;
};

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
