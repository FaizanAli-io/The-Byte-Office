import { listLedgerSummaries, loadLedger } from "@/lib/db/queries";
import { proposeAgentAction } from "./actions";
import {
  getAgentSnapshot,
  listAgentSnapshots,
  loadAgentPortfolio,
} from "./repository";
import type { AgentActionType, PendingAgentAction } from "./types";

export type OpenRouterTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const portfolioBase = {
  itemType: {
    type: "string",
    enum: ["local_bank", "remote_bank", "mutual_fund"],
  },
  name: { type: "string" },
  amountPkr: { type: "number", minimum: 0 },
  amountUsd: { type: "number", minimum: 0 },
  exchangeRate: { type: "number", exclusiveMinimum: 0 },
  bankName: { type: "string" },
  fundName: { type: "string" },
  value: { type: "number", minimum: 0 },
};

const ledgerEntryProperties = {
  date: {
    type: "string",
    description: "ISO date YYYY-MM-DD within the ledger month",
  },
  type: {
    type: "string",
    enum: [
      "income",
      "expense",
      "transfer",
      "fund_contribution",
      "fund_withdrawal",
    ],
  },
  accountId: { type: "string", description: "Stable account UUID" },
  destinationAccountId: { type: ["string", "null"] },
  amount: { type: "number", exclusiveMinimum: 0 },
  destinationAmount: { type: ["number", "null"], exclusiveMinimum: 0 },
  exchangeRate: { type: ["number", "null"], exclusiveMinimum: 0 },
  category: { type: ["string", "null"] },
  note: { type: ["string", "null"] },
};

export const financeAgentTools: OpenRouterTool[] = [
  tool(
    "portfolio_get",
    "Get the live portfolio, stable item IDs, balances, and PKR total.",
    {},
  ),
  tool(
    "snapshots_list",
    "List up to 50 saved portfolio snapshots, newest first.",
    {},
  ),
  tool(
    "snapshot_get",
    "Get one saved portfolio snapshot by its stable ID.",
    { id: { type: "string" } },
    ["id"],
  ),
  tool(
    "ledgers_list",
    "List monthly ledgers with their status and last update time.",
    {},
  ),
  tool(
    "ledger_get",
    "Get one monthly ledger with stable account and entry IDs.",
    { month: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } },
    ["month"],
  ),
  tool(
    "portfolio_item_add",
    "Create a confirmation proposal to add one portfolio item. This never writes before user confirmation. Use fields matching itemType.",
    portfolioBase,
    ["itemType"],
  ),
  tool(
    "portfolio_item_update",
    "Create a confirmation proposal to update one portfolio item by stable ID. Include only changed fields. This never writes before confirmation.",
    { ...portfolioBase, id: { type: "string" } },
    ["itemType", "id"],
  ),
  tool(
    "portfolio_item_remove",
    "Create a confirmation proposal to remove one portfolio item by stable ID. This never writes before confirmation.",
    {
      itemType: portfolioBase.itemType,
      id: { type: "string" },
    },
    ["itemType", "id"],
  ),
  tool(
    "ledger_entry_add",
    "Immediately open the add-entry form for a draft ledger. Call this as soon as the user wants to add an entry. Do not ask for type, account, amount, date, or notes — the form collects them. Type defaults to expense, account to the first account, and date to today. Only month is required. The user submits the form to save; do not claim the entry was saved.",
    {
      month: { type: "string" },
      ...ledgerEntryProperties,
    },
    ["month"],
  ),
  tool(
    "ledger_entry_update",
    "Immediately open an edit form prefilled with an existing draft ledger entry. Do not ask the user to retype fields. The user submits the form to save. Do not claim the entry was updated.",
    {
      month: { type: "string" },
      entryId: { type: "string" },
      ...ledgerEntryProperties,
    },
    ["month", "entryId"],
  ),
  tool(
    "ledger_entry_remove",
    "Create a confirmation proposal to remove an entry from a draft ledger.",
    {
      month: { type: "string" },
      entryId: { type: "string" },
    },
    ["month", "entryId"],
  ),
];

export async function executeFinanceTool(
  name: string,
  args: unknown,
): Promise<{ output: unknown; pendingAction?: PendingAgentAction }> {
  const input = asObject(args);

  if (name === "portfolio_get") {
    const portfolio = await loadAgentPortfolio();
    const grandTotalPkr =
      portfolio.localBanks.reduce((sum, item) => sum + item.amountPkr, 0) +
      portfolio.remoteBanks.reduce(
        (sum, item) => sum + item.amountUsd * item.exchangeRate,
        0,
      ) +
      portfolio.mutualFunds.reduce((sum, item) => sum + item.value, 0);
    return { output: { ...portfolio, grandTotalPkr } };
  }
  if (name === "snapshots_list") {
    return { output: await listAgentSnapshots() };
  }
  if (name === "snapshot_get") {
    const id = requireArg(input, "id");
    const snapshot = await getAgentSnapshot(id);
    if (!snapshot) throw new Error("Snapshot not found");
    return { output: snapshot };
  }
  if (name === "ledgers_list") {
    return { output: await listLedgerSummaries() };
  }
  if (name === "ledger_get") {
    const month = requireArg(input, "month");
    const ledger = await loadLedger(month);
    if (!ledger) throw new Error("Ledger not found");
    return { output: ledger };
  }

  if (isWriteTool(name)) {
    const pendingAction = await proposeAgentAction(name, input);
    return {
      output: {
        status: "pending_confirmation",
        action: pendingAction,
        instruction:
          "Tell the user to review the confirmation card. Do not claim the change was applied.",
      },
      pendingAction,
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): OpenRouterTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

function isWriteTool(name: string): name is AgentActionType {
  return [
    "portfolio_item_add",
    "portfolio_item_update",
    "portfolio_item_remove",
    "ledger_entry_add",
    "ledger_entry_update",
    "ledger_entry_remove",
  ].includes(name);
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requireArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`${key} is required`);
  }
  return value;
}
