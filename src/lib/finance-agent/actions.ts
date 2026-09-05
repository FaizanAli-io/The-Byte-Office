import { randomUUID } from "crypto";
import { loadLedger, saveLedger } from "@/lib/db/queries";
import {
  isRecord,
  validMoney,
  validName,
  validPositiveNumber,
  validateLedger,
} from "@/lib/finance-validation";
import { monthBounds } from "@/lib/ledger";
import type { LedgerAccount, LedgerEntry, MonthlyLedger } from "@/types/ledger";
import {
  addPortfolioItem,
  cancelAgentAction,
  claimAgentAction,
  completeAgentAction,
  createAgentAction,
  failAgentAction,
  fingerprint,
  getAgentAction,
  getPortfolioItem,
  removePortfolioItem,
  syncActionInMessages,
  updatePortfolioItem,
} from "./repository";
import type {
  AgentActionPayload,
  AgentActionType,
  LedgerEntryFormState,
  PendingAgentAction,
  PortfolioItemInput,
  PortfolioItemType,
} from "./types";

export class AgentActionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function proposeAgentAction(
  actionType: AgentActionType,
  rawArgs: unknown,
) {
  const args = requireRecord(rawArgs);

  if (actionType === "portfolio_item_add") {
    const item = parsePortfolioItem(args);
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, item },
        preview: {
          title: `Add ${portfolioLabel(item.itemType)}`,
          after: item,
        },
      }),
    );
  }

  if (
    actionType === "portfolio_item_update" ||
    actionType === "portfolio_item_remove"
  ) {
    const itemType = parseItemType(args.itemType);
    const id = requireString(args.id, "id");
    const current = await getPortfolioItem(itemType, id);
    if (!current) throw new AgentActionError("Portfolio item not found", 404);

    if (actionType === "portfolio_item_remove") {
      return toPublicAction(
        await createAgentAction({
          actionType,
          payload: { actionType, itemType, id },
          preview: {
            title: `Remove ${portfolioLabel(itemType)}`,
            before: current,
          },
          sourceFingerprint: fingerprint(current),
        }),
      );
    }

    const changes = parsePortfolioUpdate(itemType, args, current);
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, itemType, id, changes },
        preview: {
          title: `Update ${portfolioLabel(itemType)}`,
          before: current,
          after: changes,
        },
        sourceFingerprint: fingerprint(current),
      }),
    );
  }

  const month = requireString(args.month, "month");
  const ledger = await requireEditableLedger(month);
  const sourceFingerprint =
    actionType === "ledger_entry_add"
      ? ledgerStructureFingerprint(ledger)
      : ledgerFingerprint(ledger);

  if (actionType === "ledger_entry_add") {
    const date = defaultEntryDate(
      month,
      typeof args.date === "string" ? args.date : undefined,
    );
    const type = isEntryType(args.type) ? args.type : "expense";
    const accountId =
      typeof args.accountId === "string" &&
      ledger.accounts.some((account) => account.id === args.accountId)
        ? args.accountId
        : firstAccountId(ledger.accounts, type);
    const entry = { id: randomUUID(), date, type, accountId };
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, month, entry },
        preview: { title: "Add ledger entry" },
        sourceFingerprint,
      }),
      ledgerForm("ledger_entry_add", month, ledger.accounts, {
        date,
        type,
        accountId,
      }),
    );
  }

  const entryId = requireString(args.entryId, "entryId");
  const current = ledger.entries.find((entry) => entry.id === entryId);
  if (!current) throw new AgentActionError("Ledger entry not found", 404);

  if (actionType === "ledger_entry_remove") {
    assertLedgerWithEntries(
      ledger,
      ledger.entries.filter((entry) => entry.id !== entryId),
    );
    return toPublicAction(
      await createAgentAction({
        actionType,
        payload: { actionType, month, entryId },
        preview: { title: "Remove ledger entry", before: current },
        sourceFingerprint,
      }),
    );
  }

  return toPublicAction(
    await createAgentAction({
      actionType,
      payload: { actionType, month, entryId, entry: current },
      preview: {
        title: "Update ledger entry",
        before: current,
      },
      sourceFingerprint,
    }),
    ledgerForm("ledger_entry_update", month, ledger.accounts, {
      id: current.id,
      date: current.date,
      type: current.type,
      accountId: current.accountId,
      destinationAccountId: current.destinationAccountId,
      amount: current.amount,
      destinationAmount: current.destinationAmount,
      category: current.category,
      note: current.note,
    }),
  );
}

export async function executeAgentAction(id: string, entryOverride?: unknown) {
  const action = await claimAgentAction(id);
  if (!action) {
    const existing = await getAgentAction(id);
    if (!existing) throw new AgentActionError("Action not found", 404);
    if (existing.status === "pending" && existing.expiresAt <= new Date()) {
      await failAgentAction(id, "Action expired before confirmation");
      throw new AgentActionError("This confirmation has expired", 409);
    }
    throw new AgentActionError(
      `This action is already ${existing.status}`,
      409,
    );
  }

  try {
    const result = await executePayload(
      applyEntryOverride(
        action.payload as unknown as AgentActionPayload,
        entryOverride,
      ),
      action.sourceFingerprint,
    );
    const completed = await completeAgentAction(action.id);
    if (!completed) {
      throw new Error("Could not mark the action as completed");
    }
    const publicAction = toPublicAction(completed);
    await syncActionInMessages(action.id, publicAction);
    return { action: publicAction, result };
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Action execution failed";
    await failAgentAction(action.id, message);
    await syncActionInMessages(id, { status: "failed", error: message });
    throw cause instanceof AgentActionError
      ? cause
      : new AgentActionError(message, 409);
  }
}

export async function cancelPendingAgentAction(id: string) {
  const cancelled = await cancelAgentAction(id);
  if (cancelled) {
    const publicAction = toPublicAction(cancelled);
    await syncActionInMessages(id, publicAction);
    return publicAction;
  }

  const existing = await getAgentAction(id);
  if (!existing) throw new AgentActionError("Action not found", 404);
  throw new AgentActionError(`This action is already ${existing.status}`, 409);
}

async function executePayload(
  payload: AgentActionPayload,
  sourceFingerprint: string | null,
) {
  switch (payload.actionType) {
    case "portfolio_item_add":
      parsePortfolioItem(payload.item as unknown as Record<string, unknown>);
      return addPortfolioItem(payload.item);
    case "portfolio_item_update": {
      const current = await requireCurrentPortfolioItem(
        payload.itemType,
        payload.id,
        sourceFingerprint,
      );
      const changes = parsePortfolioUpdate(
        payload.itemType,
        payload.changes,
        current,
      );
      return updatePortfolioItem(payload.itemType, payload.id, changes);
    }
    case "portfolio_item_remove": {
      await requireCurrentPortfolioItem(
        payload.itemType,
        payload.id,
        sourceFingerprint,
      );
      const removed = await removePortfolioItem(payload.itemType, payload.id);
      if (!removed.length)
        throw new AgentActionError("Item no longer exists", 409);
      return { id: payload.id, removed: true };
    }
    case "ledger_entry_add":
    case "ledger_entry_update":
    case "ledger_entry_remove":
      return executeLedgerPayload(payload, sourceFingerprint);
  }
}

async function executeLedgerPayload(
  payload: Extract<
    AgentActionPayload,
    {
      actionType:
        | "ledger_entry_add"
        | "ledger_entry_update"
        | "ledger_entry_remove";
    }
  >,
  sourceFingerprint: string | null,
) {
  const ledger = await requireEditableLedger(payload.month);
  if (payload.actionType === "ledger_entry_add") {
    assertLedgerStructure(ledger, sourceFingerprint);
  } else if (ledgerFingerprint(ledger) !== sourceFingerprint) {
    throw new AgentActionError(
      "The ledger changed after this proposal. Ask the assistant to try again.",
      409,
    );
  }

  let entries: LedgerEntry[];
  if (payload.actionType === "ledger_entry_add") {
    const entry = parseLedgerEntry(
      payload.entry as unknown as Record<string, unknown>,
      { id: payload.entry.id },
    );
    if (ledger.entries.some((item) => item.id === entry.id)) {
      throw new AgentActionError(
        "This entry was already added. Ask the assistant to open a new form.",
        409,
      );
    }
    entries = [...ledger.entries, entry];
  } else if (payload.actionType === "ledger_entry_update") {
    if (!ledger.entries.some((entry) => entry.id === payload.entryId)) {
      throw new AgentActionError("Ledger entry no longer exists", 409);
    }
    const entry = parseLedgerEntry(
      payload.entry as unknown as Record<string, unknown>,
      { id: payload.entryId },
    );
    entries = ledger.entries.map((item) =>
      item.id === payload.entryId ? entry : item,
    );
  } else {
    if (!ledger.entries.some((entry) => entry.id === payload.entryId)) {
      throw new AgentActionError("Ledger entry no longer exists", 409);
    }
    entries = ledger.entries.filter((entry) => entry.id !== payload.entryId);
  }

  assertLedgerWithEntries(ledger, entries);
  return saveLedger(ledger, {
    month: ledger.month,
    status: ledger.status,
    accounts: ledger.accounts,
    entries,
    finalizedAt: ledger.finalizedAt,
  });
}

async function requireCurrentPortfolioItem(
  itemType: PortfolioItemType,
  id: string,
  sourceFingerprint: string | null,
) {
  const current = await getPortfolioItem(itemType, id);
  if (!current)
    throw new AgentActionError("Portfolio item no longer exists", 409);
  if (fingerprint(current) !== sourceFingerprint) {
    throw new AgentActionError(
      "The portfolio item changed after this proposal. Ask the assistant to try again.",
      409,
    );
  }
  return current;
}

async function requireEditableLedger(month: string) {
  const ledger = await loadLedger(month);
  if (!ledger) throw new AgentActionError("Ledger not found", 404);
  if (ledger.status === "finalized") {
    throw new AgentActionError("Finalized ledgers cannot be edited", 409);
  }
  return ledger;
}

function assertLedgerWithEntries(
  ledger: MonthlyLedger,
  entries: LedgerEntry[],
) {
  const error = validateLedger({
    month: ledger.month,
    status: ledger.status,
    accounts: ledger.accounts,
    entries,
    finalizedAt: ledger.finalizedAt,
  });
  if (error) throw new AgentActionError(error);
}

function ledgerFingerprint(ledger: MonthlyLedger) {
  return fingerprint({
    updatedAt: new Date(ledger.updatedAt).toISOString(),
    entries: ledger.entries,
  });
}

function ledgerStructureFingerprint(ledger: MonthlyLedger) {
  return fingerprint({
    month: ledger.month,
    status: ledger.status,
    accounts: ledger.accounts.map(({ id, type, currency, exchangeRate }) => ({
      id,
      type,
      currency,
      exchangeRate,
    })),
  });
}

function assertLedgerStructure(
  ledger: MonthlyLedger,
  sourceFingerprint: string | null,
) {
  if (ledgerStructureFingerprint(ledger) !== sourceFingerprint) {
    throw new AgentActionError(
      "The ledger accounts changed after this proposal. Ask the assistant to try again.",
      409,
    );
  }
}

function parsePortfolioItem(args: Record<string, unknown>): PortfolioItemInput {
  const itemType = parseItemType(args.itemType);
  if (itemType === "local_bank") {
    return {
      itemType,
      name: requireName(args.name, "name"),
      amountPkr: requireMoney(args.amountPkr, "amountPkr"),
    };
  }
  if (itemType === "remote_bank") {
    return {
      itemType,
      name: requireName(args.name, "name"),
      amountUsd: requireMoney(args.amountUsd, "amountUsd"),
      exchangeRate: requirePositive(args.exchangeRate, "exchangeRate"),
    };
  }
  return {
    itemType,
    bankName: requireName(args.bankName, "bankName"),
    fundName: requireName(args.fundName, "fundName"),
    value: requireMoney(args.value, "value"),
  };
}

function parsePortfolioUpdate(
  itemType: PortfolioItemType,
  args: Record<string, unknown>,
  current: Record<string, unknown>,
) {
  if (itemType === "local_bank") {
    return {
      name: requireName(args.name ?? current.name, "name"),
      amountPkr: requireMoney(args.amountPkr ?? current.amountPkr, "amountPkr"),
    };
  }
  if (itemType === "remote_bank") {
    return {
      name: requireName(args.name ?? current.name, "name"),
      amountUsd: requireMoney(args.amountUsd ?? current.amountUsd, "amountUsd"),
      exchangeRate: requirePositive(
        args.exchangeRate ?? current.exchangeRate,
        "exchangeRate",
      ),
    };
  }
  return {
    bankName: requireName(args.bankName ?? current.bankName, "bankName"),
    fundName: requireName(args.fundName ?? current.fundName, "fundName"),
    value: requireMoney(args.value ?? current.value, "value"),
  };
}

function parseLedgerEntry(
  args: Record<string, unknown>,
  base: Partial<LedgerEntry>,
): LedgerEntry {
  const optionalString = (key: "category" | "note") =>
    args[key] === null
      ? undefined
      : args[key] === undefined
        ? base[key]
        : requireString(args[key], key);
  const optionalNumber = (key: "destinationAmount" | "exchangeRate") =>
    args[key] === null
      ? undefined
      : args[key] === undefined
        ? base[key]
        : requirePositive(args[key], key);
  const destinationAccountId =
    args.destinationAccountId === null
      ? undefined
      : args.destinationAccountId === undefined
        ? base.destinationAccountId
        : requireString(args.destinationAccountId, "destinationAccountId");

  return {
    id: requireString(args.id ?? base.id, "id"),
    date: requireString(args.date ?? base.date, "date"),
    type: requireEntryType(args.type ?? base.type),
    accountId: requireString(args.accountId ?? base.accountId, "accountId"),
    destinationAccountId,
    amount: requirePositive(args.amount ?? base.amount, "amount"),
    destinationAmount: optionalNumber("destinationAmount"),
    exchangeRate: optionalNumber("exchangeRate"),
    category: optionalString("category"),
    note: optionalString("note"),
  };
}

function parseItemType(value: unknown): PortfolioItemType {
  if (
    value === "local_bank" ||
    value === "remote_bank" ||
    value === "mutual_fund"
  ) {
    return value;
  }
  throw new AgentActionError("Invalid itemType");
}

function requireEntryType(value: unknown): LedgerEntry["type"] {
  if (
    value === "income" ||
    value === "expense" ||
    value === "transfer" ||
    value === "fund_contribution" ||
    value === "fund_withdrawal"
  ) {
    return value;
  }
  throw new AgentActionError("Invalid ledger entry type");
}

function requireRecord(value: unknown) {
  if (!isRecord(value)) throw new AgentActionError("Invalid tool arguments");
  return value;
}

function requireString(value: unknown, key: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AgentActionError(`${key} is required`);
  }
  return value.trim();
}

function requireName(value: unknown, key: string) {
  if (!validName(value)) throw new AgentActionError(`${key} is required`);
  return value.trim();
}

function requireMoney(value: unknown, key: string) {
  if (!validMoney(value)) {
    throw new AgentActionError(`${key} must be a non-negative number`);
  }
  return value;
}

function requirePositive(value: unknown, key: string) {
  if (!validPositiveNumber(value)) {
    throw new AgentActionError(`${key} must be a positive number`);
  }
  return value;
}

function portfolioLabel(type: PortfolioItemType) {
  return type.replace("_", " ");
}

export function toPublicAction(
  action: {
    id: string;
    actionType: string;
    preview: { title: string; before?: unknown; after?: unknown };
    status: "pending" | "executing" | "completed" | "cancelled" | "failed";
    expiresAt: Date;
    error: string | null;
  },
  form?: LedgerEntryFormState,
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

function applyEntryOverride(
  payload: AgentActionPayload,
  override: unknown,
): AgentActionPayload {
  if (
    !isRecord(override) ||
    (payload.actionType !== "ledger_entry_add" &&
      payload.actionType !== "ledger_entry_update")
  ) {
    return payload;
  }
  if (payload.actionType === "ledger_entry_add") {
    return {
      ...payload,
      entry: {
        ...payload.entry,
        ...override,
        id: payload.entry.id,
      },
    };
  }
  return {
    ...payload,
    entry: {
      ...payload.entry,
      ...override,
      id: payload.entryId,
    },
  };
}

function ledgerForm(
  kind: LedgerEntryFormState["kind"],
  month: string,
  accounts: LedgerAccount[],
  entry: LedgerEntryFormState["entry"],
): LedgerEntryFormState {
  return {
    kind,
    month,
    accounts: accounts.map(({ id, name, currency, type, exchangeRate }) => ({
      id,
      name,
      currency,
      type,
      exchangeRate,
    })),
    entry,
  };
}

function defaultEntryDate(month: string, requested?: string) {
  const bounds = monthBounds(month);
  if (requested && requested >= bounds.min && requested <= bounds.max) {
    return requested;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (today >= bounds.min && today <= bounds.max) return today;
  return bounds.min;
}

function isEntryType(value: unknown): value is LedgerEntry["type"] {
  return (
    value === "income" ||
    value === "expense" ||
    value === "transfer" ||
    value === "fund_contribution" ||
    value === "fund_withdrawal"
  );
}

function firstAccountId(
  accounts: Pick<LedgerAccount, "id" | "type">[],
  type: LedgerEntry["type"],
) {
  const eligible =
    type === "fund_contribution" || type === "fund_withdrawal"
      ? accounts.filter((account) => account.type === "fund")
      : accounts;
  return eligible[0]?.id ?? accounts[0]?.id ?? "";
}
