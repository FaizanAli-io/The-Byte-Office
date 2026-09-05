import type { LedgerAccount, LedgerEntry } from "@/types/ledger";

export type PortfolioItemType = "local_bank" | "remote_bank" | "mutual_fund";

export type AgentActionType =
  | "portfolio_item_add"
  | "portfolio_item_update"
  | "portfolio_item_remove"
  | "ledger_entry_add"
  | "ledger_entry_update"
  | "ledger_entry_remove";

export type PortfolioItemInput =
  | {
      itemType: "local_bank";
      name: string;
      amountPkr: number;
    }
  | {
      itemType: "remote_bank";
      name: string;
      amountUsd: number;
      exchangeRate: number;
    }
  | {
      itemType: "mutual_fund";
      bankName: string;
      fundName: string;
      value: number;
    };

export type AgentActionPayload =
  | {
      actionType: "portfolio_item_add";
      item: PortfolioItemInput;
    }
  | {
      actionType: "portfolio_item_update";
      itemType: PortfolioItemType;
      id: string;
      changes: Record<string, unknown>;
    }
  | {
      actionType: "portfolio_item_remove";
      itemType: PortfolioItemType;
      id: string;
    }
  | {
      actionType: "ledger_entry_add";
      month: string;
      entry: Partial<LedgerEntry> & { id: string; date: string };
    }
  | {
      actionType: "ledger_entry_update";
      month: string;
      entryId: string;
      entry: Partial<LedgerEntry> & { id: string };
    }
  | {
      actionType: "ledger_entry_remove";
      month: string;
      entryId: string;
    };

export type ActionPreview = {
  title: string;
  before?: unknown;
  after?: unknown;
};

export type LedgerEntryFormState = {
  kind: "ledger_entry_add" | "ledger_entry_update";
  month: string;
  accounts: Pick<
    LedgerAccount,
    "id" | "name" | "currency" | "type" | "exchangeRate"
  >[];
  entry: {
    id?: string;
    date: string;
    type?: LedgerEntry["type"];
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
  status: "pending" | "executing" | "completed" | "cancelled" | "failed";
  expiresAt: string;
  error?: string | null;
  form?: LedgerEntryFormState;
};

export type FinanceChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  actions?: PendingAgentAction[];
  isError?: boolean;
};

export type FinanceAgentResponse = {
  message: FinanceChatMessage;
  model: string;
};
